import type { Db } from "./db/pool.js";
import { sha256 } from "./security.js";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 15 * 60_000;

export async function checkLoginAllowed(db: Db, ip: string, email: string) {
  const emailHash = sha256(email.trim().toLowerCase());
  const row = await db.query<{ attempts: number; window_start: string | Date; blocked_until: string | Date | null }>(
    "SELECT attempts, window_start, blocked_until FROM login_rate WHERE ip = $1 AND email_hash = $2",
    [ip || "127.0.0.1", emailHash],
  );
  const r = row.rows[0];
  const now = Date.now();
  if (r?.blocked_until) {
    const until = r.blocked_until instanceof Date ? r.blocked_until.getTime() : Date.parse(String(r.blocked_until));
    if (Number.isFinite(until) && until > now) {
      return { ok: false as const, retrySec: Math.ceil((until - now) / 1000) };
    }
  }
  if (r) {
    const start = r.window_start instanceof Date ? r.window_start.getTime() : Date.parse(String(r.window_start));
    if (now - start < WINDOW_MS && r.attempts >= MAX_ATTEMPTS) {
      const blockedUntil = new Date(now + BLOCK_MS).toISOString();
      await db.query(
        "UPDATE login_rate SET blocked_until = $3, attempts = $4 WHERE ip = $1 AND email_hash = $2",
        [ip || "127.0.0.1", emailHash, blockedUntil, r.attempts],
      );
      return { ok: false as const, retrySec: Math.ceil(BLOCK_MS / 1000) };
    }
  }
  return { ok: true as const };
}

export async function registerLoginFailure(db: Db, ip: string, email: string) {
  const emailHash = sha256(email.trim().toLowerCase());
  await db.query(
    `INSERT INTO login_rate (ip, email_hash, attempts, window_start, blocked_until)
     VALUES ($1, $2, 1, now(), NULL)
     ON CONFLICT (ip, email_hash) DO UPDATE SET
       attempts = CASE
         WHEN login_rate.window_start < now() - interval '1 minute' THEN 1
         ELSE login_rate.attempts + 1
       END,
       window_start = CASE
         WHEN login_rate.window_start < now() - interval '1 minute' THEN now()
         ELSE login_rate.window_start
       END`,
    [ip || "127.0.0.1", emailHash],
  );
}

export async function clearLoginFailures(db: Db, ip: string, email: string) {
  const emailHash = sha256(email.trim().toLowerCase());
  await db.query("DELETE FROM login_rate WHERE ip = $1 AND email_hash = $2", [ip || "127.0.0.1", emailHash]);
}
