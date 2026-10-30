import { randomUUID } from "node:crypto";
import { many, one, valor, type Consulta } from "./sql.js";

/** Sessões da equipa e dos formandos (cookie `gf_session`, guardado só como hash). */

export type ActorSessao = { id: string; email: string; name: string; role: string; must_change_password?: boolean };

/** Utilizador activo dono de uma sessão válida. */
export function actorDaSessao(c: Consulta, tokenHash: string) {
  return one<ActorSessao>(
    c,
    `SELECT u.id, u.email, u.name, u.role, u.must_change_password
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active = true`,
    [tokenHash],
  );
}

export async function criarSessao(c: Consulta, input: { userId: string; tokenHash: string; expiraEm: string; ip?: string; userAgent?: string }) {
  await one(
    c,
    "INSERT INTO sessions (id, user_id, token_hash, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6)",
    [randomUUID(), input.userId, input.tokenHash, input.expiraEm, input.ip ?? null, (input.userAgent ?? "").slice(0, 180)],
  );
}

export async function apagarSessaoPorToken(c: Consulta, tokenHash: string) {
  await one(c, "DELETE FROM sessions WHERE token_hash = $1", [tokenHash]);
}

/** Termina todas as sessões de um utilizador; devolve quantas eram válidas. */
export async function terminarSessoesDe(c: Consulta, userId: string) {
  const n = await valor<number>(c, "SELECT count(*)::int FROM sessions WHERE user_id = $1 AND expires_at > now()", [userId]);
  await one(c, "DELETE FROM sessions WHERE user_id = $1", [userId]);
  return Number(n ?? 0);
}

/** Termina as sessões do utilizador menos a do pedido (mudança da própria palavra-passe). */
export async function terminarOutrasSessoes(c: Consulta, userId: string, tokenHashAtual: string) {
  await one(c, "DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2", [userId, tokenHashAtual]);
}

export type SessaoAtiva ={ id: string; criada: string; expira: string; ip: string | null; navegador: string | null };

/** Sessões ainda válidas de um utilizador (mais recentes primeiro). */
export function sessoesAtivasDe(c: Consulta, userId: string) {
  return many<SessaoAtiva>(
    c,
    `SELECT id, created_at::text AS criada, expires_at::text AS expira, ip, user_agent AS navegador
       FROM sessions WHERE user_id = $1 AND expires_at > now()
      ORDER BY created_at DESC LIMIT 20`,
    [userId],
  );
}

// ─── Tentativas de login (bloqueio por IP + email) ───────────────────────────

export function tentativasLogin(c: Consulta, ip: string, emailHash: string) {
  return one<{ attempts: number; window_start: string | Date; blocked_until: string | Date | null }>(
    c,
    "SELECT attempts, window_start, blocked_until FROM login_rate WHERE ip = $1 AND email_hash = $2",
    [ip, emailHash],
  );
}

export async function bloquearLogin(c: Consulta, ip: string, emailHash: string, ate: string, tentativas: number) {
  await one(c, "UPDATE login_rate SET blocked_until = $3, attempts = $4 WHERE ip = $1 AND email_hash = $2", [ip, emailHash, ate, tentativas]);
}

export async function registarFalhaLogin(c: Consulta, ip: string, emailHash: string) {
  await one(
    c,
    `INSERT INTO login_rate (ip, email_hash, attempts, window_start, blocked_until)
     VALUES ($1, $2, 1, now(), NULL)
     ON CONFLICT (ip, email_hash) DO UPDATE SET
       attempts = CASE WHEN login_rate.window_start < now() - interval '1 minute' THEN 1 ELSE login_rate.attempts + 1 END,
       window_start = CASE WHEN login_rate.window_start < now() - interval '1 minute' THEN now() ELSE login_rate.window_start END`,
    [ip, emailHash],
  );
}

export async function limparFalhasLogin(c: Consulta, ip: string, emailHash: string) {
  await one(c, "DELETE FROM login_rate WHERE ip = $1 AND email_hash = $2", [ip, emailHash]);
}

// ─── Estados OAuth (Google/Microsoft/Drive) ──────────────────────────────────

export async function criarEstadoOauth(c: Consulta, input: {
  state: string; userId?: string | null; redirectTo: string; expiraEm: string; finalidade?: string | null; redirectUri?: string | null;
}) {
  await one(
    c,
    "INSERT INTO oauth_states (state, user_id, redirect_to, expires_at, purpose, oauth_redirect_uri) VALUES ($1, $2, $3, $4, $5, $6)",
    [input.state, input.userId ?? null, input.redirectTo, input.expiraEm, input.finalidade ?? "drive", input.redirectUri ?? null],
  );
}

/** Lê e apaga o estado (uso único). Devolve null se não existir ou tiver expirado. */
export async function consumirEstadoOauth(c: Consulta, state: string) {
  const row = await one<{ user_id: string | null; redirect_to: string | null; purpose: string | null; oauth_redirect_uri: string | null }>(
    c,
    "SELECT user_id, redirect_to, purpose, oauth_redirect_uri FROM oauth_states WHERE state = $1 AND expires_at > now()",
    [state],
  );
  await one(c, "DELETE FROM oauth_states WHERE state = $1", [state]);
  return row;
}
