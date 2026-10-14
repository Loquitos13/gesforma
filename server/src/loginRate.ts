import type { Db } from "./db/pool.js";
import { bloquearLogin, limparFalhasLogin, registarFalhaLogin, tentativasLogin } from "./repos/sessoes.js";
import { sha256 } from "./security.js";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60_000;

function chave(ip: string, email: string) {
  return { ip: ip || "127.0.0.1", hash: sha256(email.trim().toLowerCase()) };
}

function ms(v: string | Date) {
  return v instanceof Date ? v.getTime() : Date.parse(String(v));
}

export async function checkLoginAllowed(db: Db, ip: string, email: string) {
  const k = chave(ip, email);
  const r = await tentativasLogin(db, k.ip, k.hash);
  const now = Date.now();
  if (r?.blocked_until) {
    const until = ms(r.blocked_until);
    if (Number.isFinite(until) && until > now) {
      return { ok: false as const, retrySec: Math.ceil((until - now) / 1000) };
    }
  }
  if (r && now - ms(r.window_start) < WINDOW_MS && r.attempts >= MAX_ATTEMPTS) {
    await bloquearLogin(db, k.ip, k.hash, new Date(now + BLOCK_MS).toISOString(), r.attempts);
    return { ok: false as const, retrySec: Math.ceil(BLOCK_MS / 1000) };
  }
  return { ok: true as const };
}

export async function registerLoginFailure(db: Db, ip: string, email: string) {
  const k = chave(ip, email);
  await registarFalhaLogin(db, k.ip, k.hash);
}

export async function clearLoginFailures(db: Db, ip: string, email: string) {
  const k = chave(ip, email);
  await limparFalhasLogin(db, k.ip, k.hash);
}
