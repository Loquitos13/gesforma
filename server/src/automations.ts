import { randomUUID } from "node:crypto";
import type { Db } from "./db/pool.js";
import { buildCtaVars, ctaDestino, fillCtaHref } from "./emailCta.js";
import { parseEmailXml } from "./emailXml.js";
import { config } from "./config.js";
import { sendMail } from "./mailer.js";
import { CRM_ESTADO_RANK, crmEstadoFromEvent, EVENT_ALIASES, fillVars, isEmail, normalizeEmail, sanitizeHeader, sanitizeText } from "./security.js";

type Rule = {
  id: number;
  template_tipo: string;
  delay_seconds: number;
  curso: string | null;
  assunto: string;
  body_lines: unknown;
  body_xml: string;
  cta: string;
  cta_href: string;
  cta_ambito: string;
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
    [eventId, type, idempotencyKey.slice(0, 200), payload],
  );
  const id = inserted.rows[0]?.id;
  if (!id) return { eventId: null, queued: 0, duplicate: true };

  const keys = EVENT_ALIASES[type] ?? [type];
  const email = normalizeEmail(String(payload.email ?? ""));
  const nome = sanitizeHeader(String(payload.nome ?? "Formando"));
  const curso = sanitizeHeader(String(payload.curso ?? ""));
  const turma = sanitizeHeader(String(payload.turma ?? "-"));
  if (!isEmail(email)) throw new Error("Email do destinatário inválido.");

  const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
  const rules = await db.query<Rule>(
    `SELECT r.id, r.template_tipo, r.delay_seconds, r.curso, t.assunto, t.body_lines, t.body_xml, t.cta, t.cta_href, t.cta_ambito
     FROM email_rules r
     JOIN email_templates t ON t.tipo = r.template_tipo
     WHERE r.ativo = true AND r.trigger_key IN (${placeholders})`,
    keys,
  );

  const vars = buildCtaVars({
    nome, email, curso, turma,
    documentosUrl: String(payload.documentos_url ?? ""),
    comprovativoUrl: String(payload.comprovativo_url ?? ""),
    referencia: String(payload.referencia ?? ""),
    entidade: String(payload.entidade ?? ""),
    valor: String(payload.valor ?? ""),
    documentosLista: String(payload.documentos_lista ?? ""),
  });
  let queued = 0;
  for (const rule of rules.rows) {
    if (rule.curso && curso && rule.curso !== curso) continue;
    const subject = fillVars(rule.assunto, vars);
    const fromXml = parseEmailXml(rule.body_xml ?? "");
    const linhas = (fromXml.linhas.length ? fromXml.linhas : asLines(rule.body_lines)).map(l => fillVars(l, vars));
    const cta = fillVars(fromXml.cta || rule.cta, vars);
    const hrefTpl = fromXml.href || rule.cta_href || ctaDestino(rule.template_tipo).href;
    const href = fillCtaHref(hrefTpl, vars);
    const body = [`Olá ${nome.split(" ")[0] || nome},`, "", ...linhas, "", cta, href, "", "Equipa ENA · formacao@ena.pt"].join("\n");
    const jobId = randomUUID();
    const when = new Date(Date.now() + rule.delay_seconds * 1000).toISOString();
    await db.query(
      `INSERT INTO email_jobs (id, rule_id, event_id, to_email, to_name, subject, body_text, scheduled_at, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
       ON CONFLICT (rule_id, event_id) DO NOTHING`,
      [jobId, rule.id, id, email, nome, subject, sanitizeText(body, 8000), when, payload],
    );
    queued += 1;
  }
  await applyCrmEstado(db, type, payload).catch(() => undefined);
  return { eventId: id, queued, duplicate: false };
}

/** Avança o lead no funil quando a automatização dispara. Nunca recua Pago/Formando. */
export async function applyCrmEstado(db: Db, type: string, payload: Record<string, unknown>) {
  const target = crmEstadoFromEvent(type);
  if (!target) return;
  const rank = CRM_ESTADO_RANK[target] ?? 0;
  const email = normalizeEmail(String(payload.email ?? ""));
  const pid = Number(payload.preinscricaoId ?? payload.preinscricao_id ?? 0);
  if (!Number.isInteger(pid) && !isEmail(email)) return;
  const idOk = Number.isInteger(pid) && pid > 0;
  await db.query(
    `UPDATE preinscricoes SET estado = $1
      WHERE ($3::int > 0 AND id = $3 OR $4 <> '' AND lower(email) = $4)
        AND COALESCE((CASE estado
          WHEN 'Não contactado' THEN 0
          WHEN '1º Contacto' THEN 1
          WHEN '2º Contacto' THEN 2
          WHEN 'Pago' THEN 3
          WHEN 'Pré-inscrição' THEN 4
          WHEN 'Formando' THEN 5
          ELSE 0 END), 0) < $2
        AND estado <> 'Formando'`,
    [target, rank, idOk ? pid : 0, email],
  );
}

function leadAtSql() {
  return `CASE
    WHEN inscrito ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN to_timestamp(substring(inscrito from 1 for 16), 'YYYY-MM-DD HH24:MI')
    ELSE created_at
  END`;
}

async function enqueueCrmReminders(db: Db) {
  const leadAt = leadAtSql();
  const unpaid = await db.query<{ id: number; nome: string; apelido: string; email: string; curso: string }>(
    `SELECT id, nome, apelido, email, curso FROM preinscricoes
      WHERE estado NOT IN ('Pago', 'Formando')
        AND email <> ''
        AND (${leadAt}) <= now() - interval '3 days'`,
  );
  for (const row of unpaid.rows) {
    const email = normalizeEmail(row.email);
    if (!isEmail(email)) continue;
    await ingestEvent(
      db,
      "preinscricao.unpaid_3d",
      { email, nome: `${row.nome} ${row.apelido}`.trim(), curso: row.curso, preinscricaoId: row.id },
      `unpaid3d:${row.id}:${email}`,
    ).catch(() => undefined);
  }
  const stale = await db.query<{ id: number; nome: string; apelido: string; email: string; curso: string }>(
    `SELECT id, nome, apelido, email, curso FROM preinscricoes
      WHERE estado NOT IN ('Pago', 'Formando')
        AND email <> ''
        AND (${leadAt}) <= now() - interval '30 days'`,
  );
  for (const row of stale.rows) {
    const email = normalizeEmail(row.email);
    if (!isEmail(email)) continue;
    await ingestEvent(
      db,
      "lead.stale_30d",
      { email, nome: `${row.nome} ${row.apelido}`.trim(), curso: row.curso, preinscricaoId: row.id },
      `stale30d:${row.id}:${email}`,
    ).catch(() => undefined);
  }
}

async function enqueueTurmaReminders(db: Db) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 10);
  const gold = await db.query<{ id: number; nome: string; curso: string; data_inicio: string }>(
    "SELECT id, nome, curso, data_inicio FROM turmas_gold WHERE data_inicio IN ($1, $2) AND estado = 'Ativa'",
    [today, tomorrow],
  );
  const fin = await db.query<{ id: number; nome: string; curso: string; data_inicio: string }>(
    "SELECT id, nome, curso, data_inicio FROM turmas_fin WHERE data_inicio IN ($1, $2) AND activa = true",
    [today, tomorrow],
  );
  for (const turma of [...gold.rows, ...fin.rows]) {
    const alunos = await db.query<{ nome: string; apelido: string; email: string; curso: string }>(
      `SELECT nome, apelido, email, curso FROM formandos_gold WHERE turma_id = $1 AND email <> ''
       UNION ALL
       SELECT nome, apelido, email, curso FROM formandos_fin WHERE turma = $2 AND email <> ''`,
      [turma.id, turma.nome],
    );
    for (const a of alunos.rows) {
      const email = normalizeEmail(a.email);
      if (!isEmail(email)) continue;
      await ingestEvent(
        db,
        "turma.starts_in_24h",
        { email, nome: `${a.nome} ${a.apelido}`.trim(), curso: a.curso || turma.curso, turma: turma.nome },
        `turma24h:${turma.id}:${email}:${turma.data_inicio ?? tomorrow}`,
      ).catch(() => undefined);
    }
  }
}

export async function flushQueuedJobs(db: Db, limit = 20) {
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
      const pixel = `${config.appOrigin.replace(/\/$/, "")}/api/v1/email/open/${job.id}.gif`;
      const html = job.body_text
        .split("\n")
        .map(l => l ? `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : "<br>")
        .join("") + `<img src="${pixel}" width="1" height="1" alt="" />`;
      await sendMail(db, { to: job.to_email, name: job.to_name, subject: job.subject, text: job.body_text, html });
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

export async function processDueJobs(db: Db, limit = 20) {
  await enqueueTurmaReminders(db).catch(() => undefined);
  await enqueueCrmReminders(db).catch(() => undefined);
  return flushQueuedJobs(db, limit);
}
