import type { Db } from "../db/pool.js";
import { Filtros, many, padraoPesquisa, paginar, type Consulta } from "./sql.js";

/** Regista uma acção no `audit_log`. Usar em todas as escritas da equipa. */
export async function registarAuditoria(
  db: Db,
  actorId: string | undefined,
  action: string,
  entity: string,
  entityId?: string,
  ip?: string,
  meta: Record<string, unknown> = {},
) {
  await db.query(
    "INSERT INTO audit_log (actor_id, action, entity, entity_id, ip, meta) VALUES ($1, $2, $3, $4, $5, $6::jsonb)",
    [actorId ?? null, action, entity, entityId ?? null, ip ?? null, meta],
  );
}

export type LinhaAuditoria = {
  id: number; quando: string; accao: string; entidade: string; entidade_id: string | null; ip: string | null;
  meta: Record<string, unknown>; actor_id: string | null; actor_nome: string | null; actor_email: string | null;
};

/** Registo de auditoria paginado, com filtros de entidade, acção, utilizador, período e pesquisa. */
export function listarAuditoria(c: Consulta, f: {
  entidade?: string; accao?: string; utilizador?: string; entidadeId?: string; de?: string; ate?: string; q?: string;
  pagina: number; porPagina: number;
}) {
  const w = new Filtros();
  w.add("a.entity = ?", f.entidade);
  w.add("a.action LIKE ?", f.accao ? `${f.accao.replace(/[\%_]/g, m => `\${m}`)}%` : undefined);
  w.add("a.actor_id = ?::uuid", f.utilizador);
  w.add("a.entity_id = ?", f.entidadeId);
  w.add("a.created_at >= ?::date", f.de);
  w.add("a.created_at < (?::date + 1)", f.ate);
  const q = padraoPesquisa(f.q);
  w.add("(a.action ILIKE ? OR a.entity_id ILIKE ? OR u.name ILIKE ? OR u.email ILIKE ?)", q, q, q, q);
  return paginar<LinhaAuditoria>(
    c,
    `SELECT a.id, a.created_at::text AS quando, a.action AS accao, a.entity AS entidade, a.entity_id, a.ip, a.meta,
            a.actor_id, u.name AS actor_nome, u.email AS actor_email
       FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ${w.where}`,
    w.params,
    { pagina: f.pagina, porPagina: f.porPagina, ordem: "ORDER BY a.created_at DESC, a.id DESC" },
  );
}

/** Entidades e utilizadores que aparecem no registo (para os filtros). */
export async function opcoesAuditoria(c: Consulta) {
  const entidades = await many<{ entidade: string; total: number }>(
    c, "SELECT entity AS entidade, count(*)::int AS total FROM audit_log GROUP BY entity ORDER BY entity",
  );
  const utilizadores = await many<{ id: string; nome: string; email: string }>(
    c, "SELECT DISTINCT u.id, u.name AS nome, u.email FROM audit_log a JOIN users u ON u.id = a.actor_id ORDER BY u.name",
  );
  return { entidades, utilizadores };
}
