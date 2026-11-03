/**
 * Fatura de um pagamento: a contabilidade anexa o PDF (uma por pagamento; outra substitui-a) e a fatura segue por email,
 * em anexo, para o email da faturação (dados confirmados pela pessoa) e para o da pessoa (pré-inscrição ou pagamento),
 * sem repetir. Modelo editável «fatura» (área Contabilidade).
 */
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { readDriveContent, storeDriveFile } from "./driveFicheiros.js";
import { enviarModelo } from "./emailModelo.js";
import { dadosConfirmados, faturacaoDoPercurso } from "./faturacao.js";
import * as repo from "./repos/faturas.js";
import * as leads from "./repos/leads.js";
import { obterPagamentoDetalhe, type LinhaPagamento } from "./repos/pagamentos.js";
import { isEmail, normalizeEmail } from "./security.js";

export class FaturaErro extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

const fmtEuros = (v: number) => v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function mapFatura(f: repo.FaturaRow) {
  return {
    numero: f.numero, nome: f.nome, driveFileId: f.drive_file_id, anexadaEm: f.anexada_em,
    enviadaEm: f.enviada_em, enviadaPara: f.enviada_para,
  };
}

/** Para onde vai a fatura: o email da faturação (confirmado pela pessoa) e o da pessoa, sem repetir. */
export async function destinosFatura(db: Db, p: Pick<LinhaPagamento, "nome" | "email" | "lead_id">) {
  const out: { email: string; nome: string }[] = [];
  const juntar = (email: unknown, nome: string) => {
    const e = normalizeEmail(String(email ?? ""));
    if (isEmail(e) && !out.some(d => d.email === e)) out.push({ email: e, nome });
  };
  const lead = p.lead_id ? await leads.lead(db, p.lead_id) as Record<string, unknown> | null : null;
  if (p.lead_id) {
    const fat = await dadosConfirmados(db, p.lead_id);
    if (fat) juntar(fat.email, fat.nome);
  }
  const nome = lead ? `${lead.nome ?? ""} ${lead.apelido ?? ""}`.replace(/\s+/g, " ").trim() : p.nome;
  juntar(lead?.email || p.email, nome || p.nome);
  return out;
}

/** O que o detalhe do pagamento mostra: os dados de faturação (de uma pré-inscrição), a fatura e os destinos. */
export async function faturaDoDetalhe(db: Db, p: LinhaPagamento) {
  const lead = p.lead_id ? await leads.lead(db, p.lead_id) as Record<string, unknown> | null : null;
  const fatura = await repo.faturaDoPagamento(db, p.id);
  return {
    faturacao: lead ? await faturacaoDoPercurso(db, lead) : null,
    fatura: fatura ? mapFatura(fatura) : null,
    destinosFatura: (await destinosFatura(db, p)).map(d => d.email),
  };
}

/** Envia a fatura (PDF em anexo) para os destinos; regista o envio e, com pré-inscrição, o histórico. */
export async function enviarFatura(db: Db, pagamentoId: string, actorId?: string, bytes?: Buffer) {
  const p = await obterPagamentoDetalhe(db, pagamentoId);
  if (!p) throw new FaturaErro("Pagamento inexistente.", 404);
  const f = await repo.faturaDoPagamento(db, pagamentoId);
  if (!f) throw new FaturaErro("Este pagamento ainda não tem fatura.", 404);
  const destinos = await destinosFatura(db, p);
  if (!destinos.length) throw new FaturaErro("Sem email para onde enviar a fatura.");
  const conteudo = bytes ?? (await readDriveContent(db, f.drive_file_id).catch(() => null))?.bytes;
  if (!conteudo) throw new FaturaErro("Não foi possível ler o ficheiro da fatura: anexe-o de novo.");
  for (const d of destinos) {
    await enviarModelo(db, {
      tipo: "fatura", area: "contabilidade", para: d.email, nome: d.nome,
      vars: { curso: p.curso || "ENA", valor: fmtEuros(Number(p.valor) || 0), numero_fatura: f.numero ? ` n.º ${f.numero}` : "" },
      reserva: {
        assunto: "A sua fatura{{numero_fatura}} · {{curso}}",
        linhas: ["Obrigado pela sua inscrição. Segue em anexo a fatura{{numero_fatura}} ({{curso}}, € {{valor}}).", "Qualquer dúvida, responda a este email."],
      },
      anexos: [{ nome: f.nome, tipo: "application/pdf", conteudo }],
    });
  }
  const para = destinos.map(d => d.email);
  const enviada = (await repo.marcarEnviada(db, pagamentoId, para.join(", ")))!;
  if (p.lead_id) await logLeadEvent(db, p.lead_id, actorId, "contacto", "Fatura enviada", `Para ${para.join(" e ")}.`);
  return { fatura: mapFatura(enviada), enviadaPara: para };
}

/** Anexa a fatura (PDF) ao pagamento confirmado e, com `enviar`, envia-a logo. */
export async function anexarFatura(db: Db, pagamentoId: string, ficheiro: { nome: string; bytes: Buffer }, opts: { numero: string; enviar: boolean; actorId: string }) {
  const p = await obterPagamentoDetalhe(db, pagamentoId);
  if (!p) throw new FaturaErro("Pagamento inexistente.", 404);
  if (p.estado !== "Pago") throw new FaturaErro("A fatura anexa-se depois de o pagamento estar confirmado.");
  if (ficheiro.bytes.subarray(0, 5).toString("latin1") !== "%PDF-") throw new FaturaErro("A fatura tem de ser um PDF.", 400);
  const numero = opts.numero.replace(/\s+/g, " ").trim().slice(0, 40);
  const nome = `Fatura ${numero.replace(/[\\/]/g, "-") || p.id} - ${p.nome}.pdf`;
  const guardado = await storeDriveFile(db, opts.actorId, { name: nome, mime: "application/pdf", bytes: ficheiro.bytes }, {
    kind: "fatura", regime: p.lead_regime === "fin" ? "fin" : "gold", formando: p.nome, itemId: p.id, label: "Fatura",
  });
  await repo.gravarFatura(db, { pagamentoId, numero, driveFileId: guardado.id, nome: guardado.name, actorId: opts.actorId });
  if (p.lead_id) await logLeadEvent(db, p.lead_id, opts.actorId, "seguimento", "Fatura anexada", numero ? `N.º ${numero}` : guardado.name);
  if (opts.enviar) return enviarFatura(db, pagamentoId, opts.actorId, ficheiro.bytes);
  return { fatura: mapFatura((await repo.faturaDoPagamento(db, pagamentoId))!), enviadaPara: [] as string[] };
}
