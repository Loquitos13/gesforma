import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { apagarFicheiroSubstituido, storeDriveFile } from "./driveFicheiros.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { obterLogoEntidade } from "./entidadeLogo.js";
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

async function montar(db: Db, pagamentoId: string, recibo: repo.ReciboLinha) {
  const p = await repo.dadosParaRecibo(db, pagamentoId);
  if (!p) throw new ReciboErro("Pagamento inexistente.", 404);
  const e = await lerEntidade(db);
  const pii = readPreinscricaoPii({ pii_enc: p.lead_pii, nif: p.lead_nif, morada_fiscal: p.lead_morada, codigo_postal: p.lead_cp });
  const dados: DadosRecibo = {
    numero: numeroRecibo(recibo),
    emitidoEm: fmtData(recibo.emitido_em),
    entidade: {
      nome: e.nome, nif: e.nif, morada: e.morada, codigoPostal: e.codigoPostal, localidade: e.localidade,
      email: e.email, telefone: e.telefone, iban: e.iban, titularConta: e.titularConta,
    },
    pagador: {
      nome: p.formando_nome || p.nome, nif: pii.nif ?? "", email: p.email,
      morada: [pii.moradaFiscal, pii.codigoPostal].filter(Boolean).join(", "),
    },
    curso: p.curso, turma: p.turma ?? "", valor: Number(p.valor), metodo: p.metodo,
    data: fmtData(p.pago_em ?? p.criado), confirmadoPor: p.confirmado_por ?? "", referencia: p.id,
  };
  return { p, dados };
}

/** Estado do recibo de um pagamento (sem gerar nada). */
export async function estadoRecibo(db: Db, pagamentoId: string) {
  const r = await repo.reciboDoPagamento(db, pagamentoId);
  return r ? mapRecibo(r) : null;
}

/**
 * Emite o recibo (primeira vez: número novo) ou volta a gerá-lo com o mesmo número.
 * Guarda o PDF na Drive quando possível; sem Drive o recibo continua disponível para descarregar.
 */
export async function emitirRecibo(db: Db, pagamentoId: string, actorId: string | null) {
  const base = await repo.dadosParaRecibo(db, pagamentoId);
  if (!base) throw new ReciboErro("Pagamento inexistente.", 404);
  if (base.estado !== "Pago") throw new ReciboErro("Só um pagamento confirmado (Pago) tem recibo.");
  let recibo = await repo.reciboDoPagamento(db, pagamentoId);
  const novo = !recibo;
  if (!recibo) {
    recibo = await db.tx(async q => {
      const existente = await repo.reciboDoPagamento(q, pagamentoId);
      if (existente) return existente;
      const ano = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Lisbon" }).slice(0, 4));
      const numero = await repo.proximoNumero(q, ano);
      return (await repo.inserirRecibo(q, { pagamentoId, ano, numero, actorId, dados: {} }))!;
    });
  }
  const { p, dados } = await montar(db, pagamentoId, recibo);
  const pdf = await gerarReciboPdf(dados, await obterLogoEntidade(db));
  let driveFileId: string | undefined;
  let avisoDrive: string | null = null;
  try {
    const ficheiro = await storeDriveFile(db, actorId ?? undefined, {
      name: `Recibo ${dados.numero.replace("/", "-")} - ${dados.pagador.nome}.pdf`, mime: "application/pdf", bytes: pdf,
    }, { kind: "Pagamentos", regime: p.regime === "fin" ? "fin" : "gold", turma: p.turma ?? undefined, formando: dados.pagador.nome, label: `Recibo ${dados.numero}` }, { gerado: true });
    driveFileId = ficheiro.id;
    if (recibo.drive_file_id && recibo.drive_file_id !== ficheiro.id) await apagarFicheiroSubstituido(db, recibo.drive_file_id).catch(() => undefined);
  } catch (err) {
    avisoDrive = err instanceof Error ? err.message : "Não foi possível guardar na Drive.";
  }
  await repo.actualizarRecibo(db, recibo.id, { dados, driveFileId });
  const final = (await repo.reciboDoPagamento(db, pagamentoId))!;
  return { recibo: mapRecibo(final), novo, avisoDrive, pdf };
}

/** PDF de um recibo já emitido (gerado de novo com o mesmo número, sem mexer na Drive). */
export async function pdfDoRecibo(db: Db, pagamentoId: string) {
  const recibo = await repo.reciboDoPagamento(db, pagamentoId);
  if (!recibo) throw new ReciboErro("Este pagamento ainda não tem recibo.", 404);
  const { dados } = await montar(db, pagamentoId, recibo);
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
