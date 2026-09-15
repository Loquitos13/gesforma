import { randomUUID } from "node:crypto";
import type { Db } from "./db/pool.js";
import { sendMail } from "./mailer.js";
import { EVENT_ALIASES, fillVars, isEmail, normalizeEmail, sanitizeHeader, sanitizeText } from "./security.js";

type Rule = {
  id: number;
  template_tipo: string;
  delay_seconds: number;
  curso: string | null;
  assunto: string;
  body_lines: unknown;
  cta: string;
};

function asLines(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function ingestEvent(
  db: Db,
  type: string,
  payload: Record<string, unknown>,
  idempotencyKey: string,
) {
  const eventId = randomUUID();
  const inserted = await db.query<{ id: string }>(
    `INSERT INTO automation_events (id, type, idempotency_key, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [eventId, type, idempotencyKey.slice(0, 200), JSON.stringify(payload)],
  );
  const id = inserted.rows[0]?.id;
  if (!id) return { eventId: null, queued: 0, duplicate: true };

  const keys = EVENT_ALIASES[type] ?? [type];
  const email = normalizeEmail(String(payload.email ?? ""));
  const nome = sanitizeHeader(String(payload.nome ?? "Formando"));
  const curso = sanitizeHeader(String(payload.curso ?? ""));
  const turma = sanitizeHeader(String(payload.turma ?? "—"));
  if (!isEmail(email)) throw new Error("Email do destinatário inválido.");

  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const rules = await db.query<Rule>(
    `SELECT r.id, r.template_tipo, r.delay_seconds, r.curso, t.assunto, t.body_lines, t.cta
     FROM email_rules r
     JOIN email_templates t ON t.tipo = r.template_tipo
     WHERE r.ativo = true AND r.trigger_key IN (${placeholders})`,
    keys,
  );

  const vars = { nome, curso, turma };
  let queued = 0;
  for (const rule of rules.rows) {
    if (rule.curso && curso && rule.curso !== curso) continue;
    const subject = fillVars(rule.assunto, vars);
    const linhas = asLines(rule.body_lines).map(l => fillVars(l, vars));
    const body = [`Olá ${nome.split(" ")[0] || nome},`, "", ...linhas, "", rule.cta, "", "Equipa ENA · formacao@ena.pt"].join("\n");
    const jobId = randomUUID();
    const when = new Date(Date.now() + rule.delay_seconds * 1000).toISOString();
    await db.query(
      `INSERT INTO email_jobs (id, rule_id, event_id, to_email, to_name, subject, body_text, scheduled_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       ON CONFLICT (rule_id, event_id) DO NOTHING`,
      [jobId, rule.id, id, email, nome, subject, sanitizeText(body, 8000), when, JSON.stringify(payload)],
    );
    queued += 1;
  }
  return { eventId: id, queued, duplicate: false };
}

export async function processDueJobs(db: Db, limit = 20) {
  const due = await db.query<{
    id: string;
    to_email: string;
    to_name: string;
    subject: string;
    body_text: string;
    attempts: number;
  }>(
    `SELECT id, to_email, to_name, subject, body_text, attempts
     FROM email_jobs
     WHERE status = 'queued' AND scheduled_at <= now()
     ORDER BY scheduled_at
     LIMIT $1`,
    [limit],
  );
  let sent = 0;
  let failed = 0;
  for (const job of due.rows) {
    try {
      await sendMail({ to: job.to_email, name: job.to_name, subject: job.subject, text: job.body_text });
      await db.query(
        "UPDATE email_jobs SET status = 'sent', sent_at = now(), attempts = attempts + 1, last_error = NULL WHERE id = $1",
        [job.id],
      );
      sent += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 400) : "falha no envio";
      const next = job.attempts + 1 >= 5 ? "failed" : "queued";
      await db.query(
        "UPDATE email_jobs SET status = $2, attempts = attempts + 1, last_error = $3, scheduled_at = now() + interval '2 minutes' WHERE id = $1",
        [job.id, next, message],
      );
      failed += 1;
    }
  }
  return { picked: due.rows.length, sent, failed };
}
