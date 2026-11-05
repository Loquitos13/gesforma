/** Destinatários dos avisos internos: os utilizadores activos das equipas escolhidas (nunca a administração). */
import type { Db } from "./db/pool.js";
import { pgTextArray } from "./pedagogia/util.js";
import { isEmail, normalizeEmail } from "./security.js";
import { GRUPOS_EQUIPA, PERFIS_DO_GRUPO, type GrupoEquipa } from "../../src/partilhado/equipasAviso.js";

export function eGrupoEquipa(v: unknown): v is GrupoEquipa {
  return typeof v === "string" && (GRUPOS_EQUIPA as readonly string[]).includes(v);
}

/**
 * Emails (sem repetidos) dos utilizadores activos destas equipas. `crm`: aviso do CRM (pré-inscrições, documentos da
 * ligação pessoal, WhatsApp, propostas): fica de fora quem não tem acesso ao CRM.
 */
export async function emailsDaEquipa(db: Db, grupos: readonly string[], opts: { crm?: boolean } = {}) {
  const perfis = [...new Set(grupos.filter(eGrupoEquipa).flatMap(g => PERFIS_DO_GRUPO[g]))];
  if (!perfis.length) return [];
  const rows = (await db.query<{ name: string; email: string }>(
    // Também quem tem o perfil personalizado com algum destes perfis.
    `SELECT name, email FROM users WHERE active = true AND (role = ANY($1::text[]) OR (role = 'personalizado' AND perfis && $1::text[]))
       AND NOT ($2 AND COALESCE(sem_crm, false)) ORDER BY name`,
    [pgTextArray(perfis), Boolean(opts.crm)],
  )).rows;
  const vistos = new Set<string>();
  const out: { nome: string; email: string }[] = [];
  for (const r of rows) {
    const email = normalizeEmail(r.email);
    if (!isEmail(email) || vistos.has(email)) continue;
    vistos.add(email);
    out.push({ nome: r.name, email });
  }
  return out;
}
