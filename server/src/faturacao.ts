/**
 * Dados de faturação: depois de a inscrição Gold ficar concluída, a pessoa recebe por email uma
 * ligação pessoal para indicar nome/empresa, NIF, morada fiscal, código postal e o email da fatura.
 * Os dados ficam cifrados e a equipa vê-os no botão «Contabilidade» da ficha do CRM.
 */
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { renderModelo } from "./automations.js";
import { config } from "./config.js";
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { buildCtaVars } from "./emailCta.js";
import { decryptJson, encryptJson } from "./fieldCrypto.js";
import { sendMail } from "./mailer.js";
import { readPreinscricaoPii } from "./pii.js";
import { modeloEmail } from "./repos/emails.js";
import * as repo from "./repos/faturacao.js";
import * as leads from "./repos/leads.js";
import { isEmail, normalizeEmail } from "./security.js";

export type DadosFaturacao = { nome: string; nif: string; moradaFiscal: string; codigoPostal: string; email: string };

/** NIF/NIPC português: 9 dígitos, primeiro dígito de um tipo atribuído e dígito de controlo (módulo 11). */
export function nifValido(nif: string) {
  if (!/^[1235689]\d{8}$/.test(nif) && !/^(45|70|71|72|74|75|77|79|90|91|98|99)\d{7}$/.test(nif)) return false;
  const soma = [...nif.slice(0, 8)].reduce((s, d, i) => s + Number(d) * (9 - i), 0);
  const resto = soma % 11;
  return Number(nif[8]) === (resto < 2 ? 0 : 11 - resto);
}

export const dadosFaturacaoSchema = z.object({
  nome: z.string().trim().min(2, "Indique o nome ou a empresa.").max(200),
  nif: z.string().transform(s => s.replace(/\s/g, "").replace(/^PT/i, "")).pipe(z.string()
    .regex(/^\d{9}$/, "NIF: 9 dígitos.")
    .refine(nifValido, "NIF inválido (confira os dígitos).")),
  moradaFiscal: z.string().trim().min(5, "Indique a morada fiscal.").max(300),
  // Código postal português (0000-000); de outro país, pelo menos 4 caracteres.
  codigoPostal: z.string().trim().min(4, "Indique o código postal.").max(20)
    .refine(c => !/^\d{4}/.test(c) || /^\d{4}-\d{3}(\s.*)?$/.test(c), "Código postal: 0000-000."),
  email: z.string().trim().toLowerCase().max(200).refine(isEmail, "Email da fatura inválido."),
});

export function faturacaoUrl(token: string) {
  return `${config.appOrigin.replace(/\/$/, "")}/faturacao/${token}`;
}

function lerDados(enc: string | null | undefined): DadosFaturacao | null {
  return enc ? decryptJson<DadosFaturacao>(enc) : null;
}

/** Cria a ligação (ou reutiliza a existente) e envia o email com o modelo «faturacao». */
export async function pedirFaturacao(db: Db, leadId: number, actorId?: string) {
  const lead = await leads.lead(db, leadId) as Record<string, unknown> | null;
  if (!lead) return { enviado: false, erro: "Pré-inscrição inexistente." };
  // Faturação é só da formação Gold e depois de pago.
  if (lead.regime !== "gold") return { enviado: false, erro: "A faturação é só para a formação Gold." };
  if (!["Pago", "Formando"].includes(String(lead.estado))) return { enviado: false, erro: "Só se pedem os dados de faturação depois de pago." };
  const email = normalizeEmail(String(lead.email ?? ""));
  if (!isEmail(email)) return { enviado: false, erro: "A pré-inscrição não tem email válido." };
  const linha = await repo.garantirPedido(db, leadId, randomBytes(24).toString("base64url"));
  if (!linha) return { enviado: false, erro: "Não foi possível criar a ligação." };
  const url = faturacaoUrl(linha.token);
  const modelo = await modeloEmail(db, "faturacao");
  if (!modelo) return { enviado: false, erro: "Falta o modelo de email «faturacao».", url };
  const nome = `${lead.nome ?? ""} ${lead.apelido ?? ""}`.trim();
  const vars = { ...buildCtaVars({ nome, email, curso: String(lead.curso ?? ""), turma: "-" }), faturacao_url: url };
  const mail = renderModelo({ ...modelo, template_tipo: modelo.tipo }, nome, vars);
  await sendMail(db, { to: email, name: nome, subject: mail.subject, text: mail.text, html: mail.html });
  const nota = `Pedido dos dados de faturação: ${url}`;
  await leads.inserirContacto(db, { leadId, actorId, nota, meio: "Email" });
  await logLeadEvent(db, leadId, actorId, "contacto", "Contacto automático · faturação", nota);
  return { enviado: true, url };
}

/** Só envia uma vez por inscrição (o pedido automático no fim da inscrição Gold). */
export async function pedirFaturacaoSeFalta(db: Db, leadId: number, actorId?: string) {
  if (await repo.faturacaoDoLead(db, leadId)) return null;
  return pedirFaturacao(db, leadId, actorId);
}

/** O que a página pública mostra: o curso e os dados (já gravados, ou sugeridos a partir da ficha). */
export async function faturacaoPublica(db: Db, token: string) {
  const linha = await repo.faturacaoPorToken(db, token);
  if (!linha) return null;
  const lead = await leads.lead(db, linha.preinscricao_id) as Record<string, unknown> | null;
  if (!lead) return null;
  const gravados = lerDados(linha.dados_enc);
  const pii = readPreinscricaoPii(lead);
  const sugestao: DadosFaturacao = {
    nome: `${lead.nome ?? ""} ${lead.apelido ?? ""}`.trim(),
    nif: pii.nif ?? "",
    moradaFiscal: pii.moradaFiscal ?? "",
    codigoPostal: pii.codigoPostal ?? "",
    email: normalizeEmail(String(lead.email ?? "")),
  };
  return {
    curso: String(lead.curso ?? ""),
    preenchido: Boolean(linha.preenchido_em),
    dados: gravados ?? sugestao,
  };
}

export async function gravarFaturacaoPublica(db: Db, token: string, dados: DadosFaturacao) {
  const linha = await repo.faturacaoPorToken(db, token);
  if (!linha) return false;
  await repo.gravarDados(db, linha.preinscricao_id, encryptJson(dados));
  await logLeadEvent(db, linha.preinscricao_id, undefined, "seguimento", "Dados de faturação recebidos",
    `${dados.nome} · NIF ${dados.nif} · fatura para ${dados.email}`);
  return true;
}

/** Para o botão «Contabilidade» da ficha. */
export async function faturacaoParaEquipa(db: Db, leadId: number) {
  const linha = await repo.faturacaoDoLead(db, leadId);
  if (!linha) return { pedido: false as const };
  return {
    pedido: true as const,
    pedidoEm: linha.pedido_em,
    preenchidoEm: linha.preenchido_em,
    url: faturacaoUrl(linha.token),
    dados: lerDados(linha.dados_enc),
  };
}
