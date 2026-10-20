import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { apagarFicheiroSubstituido, storeDriveFile } from "./driveFicheiros.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { obterLogoEntidade } from "./entidadeLogo.js";
import type { DadosFaturacao } from "./faturacao.js";
import { decryptJson } from "./fieldCrypto.js";
import { sendMail } from "./mailer.js";
import { readPreinscricaoPii } from "./pii.js";
import { gerarReciboPdf, euros, type DadosRecibo } from "./reciboPdf.js";
import { lerEntidade } from "./regrasConfig.js";
import * as repo from "./repos/recibos.js";
import { modeloEmail } from "./repos/emails.js";
import { isEmail, normalizeEmail } from "./security.js";

/**
 * Recibos internos: só para pagamentos confirmados (estado Pago). O número é atribuído
 * na primeira emissão (sequência anual) e mantém-se quando o recibo é gerado de novo.
 */

export class ReciboErro extends Error {
  constructor(message: string, readonly codigo: 404 | 409 = 409) { super(message); }
}

const fmtData = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString("pt-PT", { timeZone: "Europe/Lisbon" });
};

export const numeroRecibo = (r: { numero: number; ano: number }) => `${String(r.numero).padStart(4, "0")}/${r.ano}`;

export function mapRecibo(r: repo.ReciboLinha) {
  return {
    numero: numeroRecibo(r), emitidoEm: r.emitido_em, actualizadoEm: r.actualizado_em,
    noDrive: Boolean(r.drive_file_id), driveFileId: r.drive_file_id || null,
    enviadoEm: r.enviado_em, enviadoPara: r.enviado_para || null,
  };
}

async function montar(db: Db, pagamentoId: string, recibo: Pick<repo.ReciboLinha, "numero" | "ano" | "emitido_em">) {
  const p = await repo.dadosParaRecibo(db, pagamentoId);
  if (!p) throw new ReciboErro("Pagamento inexistente.", 404);
  const e = await lerEntidade(db);
  const pii = readPreinscricaoPii({ pii_enc: p.lead_pii, nif: p.lead_nif, morada_fiscal: p.lead_morada, codigo_postal: p.lead_cp });
  // Os dados de faturação indicados pela pessoa (nome/empresa, NIF, morada) prevalecem sobre os da pré-inscrição.
  const fat = p.faturacao_enc ? decryptJson<DadosFaturacao>(p.faturacao_enc) : null;
  // Faturado a outra pessoa ou à empresa: o recibo diz também quem é o formando.
  const formando = p.formando_nome || p.nome;
  const outroPagador = fat && fat.nome.trim().toLowerCase() !== formando.trim().toLowerCase();
  const dados: DadosRecibo = {
    numero: numeroRecibo(recibo),
    emitidoEm: fmtData(recibo.emitido_em),
    entidade: {
      nome: e.nome, nif: e.nif, morada: e.morada, codigoPostal: e.codigoPostal, localidade: e.localidade,
      email: e.email, telefone: e.telefone, iban: e.iban, titularConta: e.titularConta,
    },
    pagador: fat
      ? { nome: fat.nome, nif: fat.nif, email: fat.email || p.email, morada: [fat.moradaFiscal, fat.codigoPostal].filter(Boolean).join(", ") }
      : {
        nome: p.formando_nome || p.nome, nif: pii.nif ?? "", email: p.email,
        morada: [pii.moradaFiscal, pii.codigoPostal].filter(Boolean).join(", "),
      },
    ...(outroPagador ? { formando } : {}),
    curso: p.curso, turma: p.turma ?? "", valor: Number(p.valor), metodo: p.metodo,
    data: fmtData(p.pago_em ?? p.criado), confirmadoPor: p.confirmado_por ?? "", referencia: p.id,
  };
  return { p, dados };
}

/** Recibo já emitido: os dados gravados na emissão (o valor e o pagador não mudam depois). */
function dadosGravados(recibo: repo.ReciboLinha) {
  const d = recibo.dados as DadosRecibo | null;
  return d?.numero ? d : null;
}

/** Estado do recibo de um pagamento (sem gerar nada). */
export async function estadoRecibo(db: Db, pagamentoId: string) {
  const r = await repo.reciboDoPagamento(db, pagamentoId);
  return r ? mapRecibo(r) : null;
}

/**
 * Emite o recibo (primeira vez: número novo) ou volta a gerá-lo com o mesmo número e os dados da emissão.
 * Guarda o PDF na Drive quando possível; sem Drive o recibo continua disponível para descarregar.
 */
export async function emitirRecibo(db: Db, pagamentoId: string, actorId: string | null) {
  const base = await repo.dadosParaRecibo(db, pagamentoId);
  if (!base) throw new ReciboErro("Pagamento inexistente.", 404);
  if (base.estado !== "Pago") throw new ReciboErro("Só um pagamento confirmado (Pago) tem recibo.");
  let recibo = await repo.reciboDoPagamento(db, pagamentoId);
  const novo = !recibo;
  if (!recibo) {
    // Os dados (valor, pagador, linhas) ficam gravados na mesma instrução que atribui o número:
    // a partir daí o recibo não muda (a base recusa qualquer alteração, migração 131).
    const ano = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" }).slice(0, 4));
    const { dados: base } = await montar(db, pagamentoId, { numero: 0, ano, emitido_em: new Date().toISOString() });
    recibo = await db.tx(async q => {
      const existente = await repo.reciboDoPagamento(q, pagamentoId);
      if (existente) return existente;
      const numero = await repo.proximoNumero(q, ano);
      return (await repo.inserirRecibo(q, { pagamentoId, ano, numero, actorId, dados: { ...base, numero: numeroRecibo({ numero, ano }) } }))!;
    });
  }
  const gravados = dadosGravados(recibo);
  const dados = gravados ?? (await montar(db, pagamentoId, recibo)).dados;
  const pdf = await gerarReciboPdf(dados, await obterLogoEntidade(db));
  let driveFileId: string | undefined;
  let avisoDrive: string | null = null;
  try {
    const ficheiro = await storeDriveFile(db, actorId ?? undefined, {
      name: `Recibo ${dados.numero.replace("/", "-")} - ${dados.pagador.nome}.pdf`, mime: "application/pdf", bytes: pdf,
    }, { kind: "Pagamentos", regime: base.regime === "fin" ? "fin" : "gold", turma: base.turma ?? undefined, formando: dados.pagador.nome, label: `Recibo ${dados.numero}` }, { gerado: true });
    driveFileId = ficheiro.id;
    if (recibo.drive_file_id && recibo.drive_file_id !== ficheiro.id) await apagarFicheiroSubstituido(db, recibo.drive_file_id).catch(() => undefined);
  } catch (err) {
    avisoDrive = err instanceof Error ? err.message : "Não foi possível guardar na Drive.";
  }
  // Recibos antigos sem dados gravados: grava-os agora (uma vez); os outros só actualizam a Drive.
  await repo.actualizarRecibo(db, recibo.id, { dados: gravados ? undefined : dados, driveFileId });
  const final = (await repo.reciboDoPagamento(db, pagamentoId))!;
  return { recibo: mapRecibo(final), novo, avisoDrive, pdf };
}

/** PDF de um recibo já emitido (com os dados da emissão, sem mexer na Drive). */
export async function pdfDoRecibo(db: Db, pagamentoId: string) {
  const recibo = await repo.reciboDoPagamento(db, pagamentoId);
  if (!recibo) throw new ReciboErro("Este pagamento ainda não tem recibo.", 404);
  const dados = dadosGravados(recibo) ?? (await montar(db, pagamentoId, recibo)).dados;
  return { pdf: await gerarReciboPdf(dados, await obterLogoEntidade(db)), numero: dados.numero, nome: dados.pagador.nome };
}

/** Envia o recibo por email (modelo «recibo» de Sistema › Emails), com o PDF em anexo. */
export async function enviarRecibo(db: Db, pagamentoId: string, para?: string) {
  const base = await repo.dadosParaRecibo(db, pagamentoId);
  if (!base) throw new ReciboErro("Pagamento inexistente.", 404);
  const destino = normalizeEmail(para || base.email);
  if (!isEmail(destino)) throw new ReciboErro("O pagamento não tem um email válido.");
  let recibo = await repo.reciboDoPagamento(db, pagamentoId);
  if (!recibo) {
    await emitirRecibo(db, pagamentoId, null);
    recibo = (await repo.reciboDoPagamento(db, pagamentoId))!;
  }
  const { pdf, numero, nome } = await pdfDoRecibo(db, pagamentoId);
  const modelo = await modeloEmail(db, "recibo");
  const vars = { nome, curso: base.curso, valor: euros(Number(base.valor)), numero };
  const mail = renderAutomaticEmail({
    nome, xml: modelo?.body_xml ?? "", linhas: modelo?.linhas.length ? modelo.linhas : [`Segue em anexo o recibo n.º ${numero}.`],
    cta: "", href: "", vars, origin: config.appOrigin,
  });
  const assunto = (modelo?.assunto || "Recibo de pagamento · {{curso}}").replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k as keyof typeof vars] ?? "");
  await sendMail(db, {
    to: destino, name: nome, subject: assunto, text: mail.text, html: mail.html,
    anexos: [{ nome: `Recibo ${numero.replace("/", "-")}.pdf`, tipo: "application/pdf", conteudo: pdf }],
  });
  await repo.marcarEnviado(db, recibo.id, destino);
  return mapRecibo((await repo.reciboDoPagamento(db, pagamentoId))!);
}
