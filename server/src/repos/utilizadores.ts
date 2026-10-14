import { Filtros, many, one, padraoPesquisa, valor, type Consulta } from "./sql.js";

/** Contas de acesso (equipa, formadores e formandos). */

export const PERFIS = ["admin", "secretaria", "comercial", "financiada", "formador", "formando"] as const;
export type PerfilUtilizador = (typeof PERFIS)[number];

export type LinhaUtilizador = {
  id: string;
  name: string;
  email: string;
  role: PerfilUtilizador;
  active: boolean;
  must_change_password: boolean;
  created_at: string;
  last_login_at: string | null;
  sessions_open: number;
};

const SELECT = `
  SELECT u.id, u.name, u.email, u.role, u.active, COALESCE(u.must_change_password, false) AS must_change_password,
         u.created_at::text AS created_at,
         (SELECT max(s.created_at)::text FROM sessions s WHERE s.user_id = u.id) AS last_login_at,
         (SELECT count(*)::int FROM sessions s WHERE s.user_id = u.id AND s.expires_at > now()) AS sessions_open
    FROM users u`;

/** Lista com filtros de perfil, estado e pesquisa (nome/email) e contagens por perfil. */
export async function listarUtilizadores(c: Consulta, f: { perfil?: string; estado?: "ativos" | "inativos"; q?: string; incluirFormandos?: boolean }) {
  const w = new Filtros();
  w.add("u.role = ?", f.perfil);
  if (f.estado === "ativos") w.sempre("u.active = true");
  if (f.estado === "inativos") w.sempre("u.active = false");
  if (!f.incluirFormandos && f.perfil !== "formando") w.sempre("u.role <> 'formando'");
  const p = padraoPesquisa(f.q);
  w.add("(u.name ILIKE ? OR u.email ILIKE ?)", p, p);
  const linhas = await many<LinhaUtilizador>(c, `${SELECT} ${w.where} ORDER BY u.active DESC, u.name ASC LIMIT 500`, w.params);
  const contagens = await many<{ role: string; total: number; ativos: number }>(
    c,
    "SELECT role, count(*)::int AS total, count(*) FILTER (WHERE active)::int AS ativos FROM users GROUP BY role",
  );
  return { linhas, contagens };
}

export function obterUtilizador(c: Consulta, id: string) {
  return one<LinhaUtilizador>(c, `${SELECT} WHERE u.id = $1`, [id]);
}

/** Para o login: inclui o hash da palavra-passe. */
export function utilizadorParaLogin(c: Consulta, email: string) {
  return one<{ id: string; password_hash: string; name: string; role: string; active: boolean; must_change_password: boolean | null }>(
    c,
    "SELECT id, password_hash, name, role, active, must_change_password FROM users WHERE email = $1",
    [email],
  );
}

export function utilizadorPorEmail(c: Consulta, email: string) {
  return one<{ id: string; name: string; role: string; active: boolean }>(
    c,
    "SELECT id, name, role, active FROM users WHERE email = $1",
    [email],
  );
}

export async function criarUtilizador(c: Consulta, u: {
  id: string; name: string; email: string; passwordHash: string; role: PerfilUtilizador; active: boolean; mustChangePassword: boolean;
}) {
  await one(
    c,
    "INSERT INTO users (id, name, email, password_hash, role, active, must_change_password) VALUES ($1, $2, $3, $4, $5, $6, $7)",
    [u.id, u.name, u.email, u.passwordHash, u.role, u.active, u.mustChangePassword],
  );
}

export async function actualizarUtilizador(c: Consulta, id: string, p: { name?: string; email?: string; role?: string; active?: boolean }) {
  await one(
    c,
    `UPDATE users SET name = COALESCE($2, name), email = COALESCE($3, email), role = COALESCE($4, role), active = COALESCE($5, active)
      WHERE id = $1`,
    [id, p.name ?? null, p.email ?? null, p.role ?? null, p.active ?? null],
  );
}

export async function definirPalavraPasse(c: Consulta, id: string, hash: string, opts: { mudarNoProximo?: boolean } = {}) {
  await one(
    c,
    "UPDATE users SET password_hash = $2, must_change_password = COALESCE($3, must_change_password) WHERE id = $1",
    [id, hash, opts.mudarNoProximo ?? null],
  );
}

export async function apagarUtilizador(c: Consulta, id: string) {
  await one(c, "DELETE FROM users WHERE id = $1", [id]);
}

export async function contarAdminsAtivos(c: Consulta, excepto?: string) {
  const n = await valor<number>(
    c,
    "SELECT count(*)::int FROM users WHERE role = 'admin' AND active = true AND ($1::uuid IS NULL OR id <> $1::uuid)",
    [excepto ?? null],
  );
  return Number(n ?? 0);
}

export function eViolacaoUnica(err: unknown) {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code) : "";
  const msg = err instanceof Error ? err.message : "";
  return code === "23505" || /unique|duplicate/i.test(msg);
}
