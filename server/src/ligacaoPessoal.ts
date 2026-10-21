import { randomBytes } from "node:crypto";
import type { Db } from "./db/pool.js";
import { pendenciaDocsLead } from "./pendenciaDocs.js";
import * as leads from "./repos/leads.js";

/**
 * Ciclo de vida da ligação pessoal `/documentos/:token` da pré-inscrição.
 * A ligação está aberta até a secretaria validar, a pessoa desistir/passar a formando,
 * ou ficar 90 dias sem uso. Enquanto faltarem documentos obrigatórios (ou houver recusados por corrigir)
 * os 90 dias não contam: a ligação fica aberta até à regularização (ver `fechoDaLigacao`).
 * Fechada, só mostra que o percurso terminou — sem dados nem envios.
 */

export const DIAS_INACTIVIDADE = 90;

export type MotivoFecho = "validada" | "desistiu" | "formando" | "expirada";

type LeadLigacao = {
  validada_em?: unknown;
  estado?: unknown;
  docs_token_usado_em?: unknown;
  docs_token_criado_em?: unknown;
  created_at?: unknown;
};

function data(v: unknown) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function motivoFecho(lead: LeadLigacao, agora = new Date()): MotivoFecho | null {
  if (lead.validada_em) return "validada";
  const estado = String(lead.estado ?? "");
  if (estado === "Desistiu") return "desistiu";
  if (estado === "Formando") return "formando";
  const base = data(lead.docs_token_usado_em) ?? data(lead.docs_token_criado_em) ?? data(lead.created_at);
  if (base && agora.getTime() - base.getTime() > DIAS_INACTIVIDADE * 86400_000) return "expirada";
  return null;
}

/**
 * Como `motivoFecho`, mas a expiração por inactividade não se aplica enquanto a documentação obrigatória
 * estiver pendente (em falta ou recusada): a pessoa tem de poder regularizar com a mesma ligação.
 */
export async function fechoDaLigacao(
  db: Db,
  lead: LeadLigacao & { id?: unknown; curso?: unknown; regime?: unknown },
  agora = new Date(),
): Promise<MotivoFecho | null> {
  const motivo = motivoFecho(lead, agora);
  if (motivo !== "expirada" || !lead.id) return motivo;
  const p = await pendenciaDocsLead(db, { id: Number(lead.id), curso: lead.curso, regime: lead.regime });
  return p.pendente ? null : motivo;
}

const TEXTO: Record<MotivoFecho, string> = {
  validada: "A secretaria já validou esta pré-inscrição. A ligação foi encerrada.",
  formando: "A inscrição já está concluída. A ligação foi encerrada.",
  desistiu: "Esta pré-inscrição foi cancelada. Contacte a secretaria se quiser retomá-la.",
  expirada: "Esta ligação expirou. Peça à secretaria uma nova ligação.",
};

export function textoFecho(m: MotivoFecho) {
  return TEXTO[m];
}

/** O que a página pública mostra com a ligação fechada: nada de dados pessoais. */
export function vistaEncerrada(lead: { nome?: unknown; curso?: unknown }, motivo: MotivoFecho) {
  return {
    encerrada: true as const,
    motivo,
    mensagem: TEXTO[motivo],
    primeiroNome: String(lead.nome ?? "").trim().split(/\s+/)[0] ?? "",
    curso: String(lead.curso ?? ""),
  };
}

function novoToken() {
  return randomBytes(24).toString("base64url");
}

/** Devolve o token da pré-inscrição, criando-o (com data) se ainda não existe. */
export async function garantirToken(db: Db, id: number) {
  const atual = await leads.tokenDoLead(db, id);
  if (atual) return atual;
  await leads.gravarTokenSeVazio(db, id, novoToken());
  return (await leads.tokenDoLead(db, id)) ?? "";
}

/** Troca o token: a ligação antiga deixa de funcionar e a nova conta os 90 dias de novo. */
export async function regenerarToken(db: Db, id: number) {
  const token = novoToken();
  await leads.trocarToken(db, id, token);
  return token;
}

export async function leadPorToken(db: Db, token: string) {
  if (token.length < 12 || token.length > 80) return null;
  return leads.leadPorToken(db, token);
}

export async function marcarUso(db: Db, id: number) {
  await leads.marcarUsoToken(db, id);
}
