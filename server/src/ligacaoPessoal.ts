import { randomBytes } from "node:crypto";
import type { Db } from "./db/pool.js";

/**
 * Ciclo de vida da ligação pessoal `/documentos/:token` da pré-inscrição.
 * A ligação está aberta até a secretaria validar, a pessoa desistir/passar a formando,
 * ou ficar 90 dias sem uso. Fechada, só mostra que o percurso terminou — sem dados nem envios.
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
  const row = await db.query<{ docs_token: string | null }>("SELECT docs_token FROM preinscricoes WHERE id = $1", [id]);
  const atual = row.rows[0]?.docs_token;
  if (atual) return atual;
  await db.query(
    "UPDATE preinscricoes SET docs_token = $2, docs_token_criado_em = now(), docs_token_usado_em = NULL WHERE id = $1 AND docs_token IS NULL",
    [id, novoToken()],
  );
  const again = await db.query<{ docs_token: string | null }>("SELECT docs_token FROM preinscricoes WHERE id = $1", [id]);
  return again.rows[0]?.docs_token ?? "";
}

/** Troca o token: a ligação antiga deixa de funcionar e a nova conta os 90 dias de novo. */
export async function regenerarToken(db: Db, id: number) {
  const token = novoToken();
  await db.query(
    "UPDATE preinscricoes SET docs_token = $2, docs_token_criado_em = now(), docs_token_usado_em = NULL, lembretes_enviados = 0 WHERE id = $1",
    [id, token],
  );
  return token;
}

export async function leadPorToken(db: Db, token: string) {
  if (token.length < 12 || token.length > 80) return null;
  const r = await db.query("SELECT * FROM preinscricoes WHERE docs_token = $1", [token]);
  return (r.rows[0] as Record<string, unknown> | undefined) ?? null;
}

export async function marcarUso(db: Db, id: number) {
  await db.query("UPDATE preinscricoes SET docs_token_usado_em = now() WHERE id = $1", [id]);
}
