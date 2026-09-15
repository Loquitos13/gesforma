import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { randomUUID } from "node:crypto";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { z } from "zod";
import { ingestEvent, processDueJobs } from "./automations.js";
import { allowedOrigins, config, newToken, onVercel } from "./config.js";
import type { Db } from "./db/pool.js";
import {
  delayLabelFromSeconds,
  delaySecondsFromLabel,
  isEmail,
  normalizeEmail,
  sha256,
  TRIGGER_MAP,
  verifyPassword,
} from "./security.js";

declare module "fastify" {
  interface FastifyInstance { db: Db }
  interface FastifyRequest {
    actor?: { id: string; email: string; name: string; role: string };
  }
}

const loginSchema = z.object({
  email: z.string().max(254),
  password: z.string().min(8).max(200),
});

const ruleSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  gatilho: z.string().min(2).max(160),
  templateTipo: z.string().min(2).max(64),
  atraso: z.string().max(40).optional(),
  curso: z.string().max(200).optional().nullable(),
  ativo: z.boolean().optional(),
});

const eventSchema = z.object({
  type: z.enum([
    "preinscricao.created",
    "payment.confirmed",
    "sale.followup",
    "formando.completed",
    "sessao.summary_signed",
    "preinscricao.unpaid_3d",
    "turma.starts_in_24h",
    "lead.stale_30d",
  ]),
  payload: z.object({
    email: z.string(),
    nome: z.string().min(1).max(160),
    curso: z.string().max(200).optional(),
    turma: z.string().max(120).optional(),
  }),
  idempotencyKey: z.string().min(8).max(200),
});

const templatePatchSchema = z.object({
  nome: z.string().trim().min(2).max(120).optional(),
  assunto: z.string().trim().min(2).max(200).optional(),
  body_lines: z.array(z.string().trim().min(1).max(800)).min(1).max(20).optional(),
  body_xml: z.string().trim().min(8).max(8000).optional(),
  cta: z.string().trim().min(1).max(80).optional(),
});

function clientOk(req: FastifyRequest) {
  const origin = req.headers.origin;
  if (origin) return allowedOrigins().has(origin);
  return req.headers["x-gesforma-client"] === "web";
}

async function audit(db: Db, actorId: string | undefined, action: string, entity: string, entityId?: string, ip?: string, meta: Record<string, unknown> = {}) {
  await db.query(
    "INSERT INTO audit_log (actor_id, action, entity, entity_id, ip, meta) VALUES ($1, $2, $3, $4, $5, $6::jsonb)",
    [actorId ?? null, action, entity, entityId ?? null, ip ?? null, JSON.stringify(meta)],
  );
}

export async function buildApp(db: Db, opts: { worker?: boolean } = {}) {
  const app = Fastify({
    logger: true,
    trustProxy: config.trustProxy,
    bodyLimit: 32 * 1024,
    requestTimeout: 15_000,
    disableRequestLogging: false,
  });
  app.decorate("db", db);

  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "no-referrer" },
  });
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins().has(origin)) cb(null, true);
      else cb(new Error("origem recusada"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-Gesforma-Client"],
    maxAge: 600,
  });
  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    allowList: ["/health"],
  });

  app.addHook("onRequest", async (req, reply) => {
    if (req.method !== "GET" && req.method !== "HEAD" && req.url !== "/health") {
      if (!clientOk(req)) {
        return reply.code(403).send({ error: "origem recusada" });
      }
    }
  });

  app.addHook("preHandler", async (req) => {
    const raw = req.cookies[config.cookieName];
    if (!raw) return;
    const hash = sha256(raw);
    const row = await db.query<{ id: string; email: string; name: string; role: string }>(
      `SELECT u.id, u.email, u.name, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active = true`,
      [hash],
    );
    if (row.rows[0]) req.actor = row.rows[0];
  });

  function requireAuth(req: FastifyRequest, reply: FastifyReply) {
    if (!req.actor) {
      reply.code(401).send({ error: "sessão inválida" });
      return false;
    }
    return true;
  }

  function setSessionCookie(reply: FastifyReply, token: string, days: number) {
    reply.setCookie(config.cookieName, token, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: config.isProd || onVercel,
      maxAge: days * 86400,
    });
  }

  app.get("/health", async () => ({
    ok: true,
    driver: db.driver,
    mail: config.mailMode,
  }));

  app.post("/v1/auth/login", {
    config: { rateLimit: { max: 8, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const email = normalizeEmail(parsed.data.email);
    if (!isEmail(email)) return reply.code(400).send({ error: "credenciais inválidas" });
    const user = await db.query<{ id: string; password_hash: string; name: string; role: string; active: boolean }>(
      "SELECT id, password_hash, name, role, active FROM users WHERE email = $1",
      [email],
    );
    const row = user.rows[0];
    const dummy = "scrypt$16384$8$1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";
    const ok = await verifyPassword(parsed.data.password, row?.password_hash ?? dummy);
    if (!row || !row.active || !ok) {
      await audit(db, row?.id, "auth.login_failed", "user", row?.id, req.ip);
      return reply.code(401).send({ error: "credenciais inválidas" });
    }
    const token = newToken();
    const exp = new Date(Date.now() + config.sessionDays * 86400_000).toISOString();
    await db.query(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6)",
      [randomUUID(), row.id, sha256(token), exp, req.ip, String(req.headers["user-agent"] ?? "").slice(0, 180)],
    );
    setSessionCookie(reply, token, config.sessionDays);
    await audit(db, row.id, "auth.login", "user", row.id, req.ip);
    return { user: { id: row.id, email, name: row.name, role: row.role } };
  });

  app.post("/v1/auth/logout", async (req, reply) => {
    const raw = req.cookies[config.cookieName];
    if (raw) await db.query("DELETE FROM sessions WHERE token_hash = $1", [sha256(raw)]);
    reply.clearCookie(config.cookieName, { path: "/" });
    if (req.actor) await audit(db, req.actor.id, "auth.logout", "user", req.actor.id, req.ip);
    return { ok: true };
  });

  app.get("/v1/me", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return { user: req.actor };
  });

  app.get("/v1/email/templates", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await db.query(
      "SELECT id, tipo, nome, assunto, body_lines, body_xml, cta, updated_at FROM email_templates ORDER BY id",
    );
    return { templates: rows.rows };
  });

  app.patch("/v1/email/templates/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = templatePatchSchema.safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const patch = parsed.data;
    await db.query(
      `UPDATE email_templates SET
         nome = COALESCE($2, nome),
         assunto = COALESCE($3, assunto),
         body_lines = COALESCE($4::jsonb, body_lines),
         cta = COALESCE($5, cta),
         body_xml = COALESCE($6, body_xml),
         updated_at = now()
       WHERE id = $1`,
      [
        id,
        patch.nome ?? null,
        patch.assunto ?? null,
        patch.body_lines ? JSON.stringify(patch.body_lines) : null,
        patch.cta ?? null,
        patch.body_xml ?? null,
      ],
    );
    await audit(db, req.actor!.id, "email.template_update", "email_template", String(id), req.ip);
    const row = await db.query(
      "SELECT id, tipo, nome, assunto, body_lines, body_xml, cta, updated_at FROM email_templates WHERE id = $1",
      [id],
    );
    return { template: row.rows[0] };
  });

  app.get("/v1/email/rules", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await db.query<{
      id: number; nome: string; gatilho_label: string; template_tipo: string;
      delay_seconds: number; curso: string | null; ativo: boolean; envios: number;
    }>(
      `SELECT r.id, r.nome, r.gatilho_label, r.template_tipo, r.delay_seconds, r.curso, r.ativo,
              (SELECT count(*)::int FROM email_jobs j WHERE j.rule_id = r.id AND j.status = 'sent') AS envios
       FROM email_rules r ORDER BY r.id`,
    );
    return {
      rules: rows.rows.map(r => ({
        id: r.id,
        nome: r.nome,
        gatilho: r.gatilho_label,
        template: r.template_tipo,
        atraso: delayLabelFromSeconds(r.delay_seconds),
        curso: r.curso,
        ativo: r.ativo,
        envios: r.envios,
        taxaAbertura: 0,
      })),
    };
  });

  app.post("/v1/email/rules", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = ruleSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const key = TRIGGER_MAP[parsed.data.gatilho];
    if (!key) return reply.code(400).send({ error: "gatilho desconhecido" });
    const tpl = await db.query("SELECT tipo FROM email_templates WHERE tipo = $1", [parsed.data.templateTipo]);
    if (!tpl.rows[0]) return reply.code(400).send({ error: "template desconhecido" });
    const inserted = await db.query<{ id: number }>(
      `INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, curso, ativo)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        parsed.data.nome,
        key,
        parsed.data.gatilho,
        parsed.data.templateTipo,
        delaySecondsFromLabel(parsed.data.atraso ?? "Imediatamente"),
        parsed.data.curso || null,
        parsed.data.ativo ?? true,
      ],
    );
    await audit(db, req.actor!.id, "email.rule_create", "email_rule", String(inserted.rows[0].id), req.ip);
    return { id: inserted.rows[0].id };
  });

  app.patch("/v1/email/rules/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = ruleSchema.partial().safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const key = d.gatilho ? TRIGGER_MAP[d.gatilho] : undefined;
    if (d.gatilho && !key) return reply.code(400).send({ error: "gatilho desconhecido" });
    await db.query(
      `UPDATE email_rules SET
         nome = COALESCE($2, nome),
         gatilho_label = COALESCE($3, gatilho_label),
         trigger_key = COALESCE($4, trigger_key),
         template_tipo = COALESCE($5, template_tipo),
         delay_seconds = COALESCE($6, delay_seconds),
         curso = COALESCE($7, curso),
         ativo = COALESCE($8, ativo)
       WHERE id = $1`,
      [
        id,
        d.nome ?? null,
        d.gatilho ?? null,
        key ?? null,
        d.templateTipo ?? null,
        d.atraso != null ? delaySecondsFromLabel(d.atraso) : null,
        d.curso === undefined ? null : (d.curso || null),
        d.ativo ?? null,
      ],
    );
    await audit(db, req.actor!.id, "email.rule_update", "email_rule", String(id), req.ip);
    return { ok: true };
  });

  app.delete("/v1/email/rules/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: "pedido inválido" });
    await db.query("DELETE FROM email_rules WHERE id = $1", [id]);
    await audit(db, req.actor!.id, "email.rule_delete", "email_rule", String(id), req.ip);
    return { ok: true };
  });

  app.get("/v1/cron/email", async (req, reply) => {
    const cron = req.headers["x-vercel-cron"] === "1";
    const bearer = config.cronSecret && req.headers.authorization === `Bearer ${config.cronSecret}`;
    if (!cron && !bearer) return reply.code(401).send({ error: "cron recusado" });
    return processDueJobs(db);
  });

  app.get("/v1/email/jobs", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await processDueJobs(db).catch(() => undefined);
    const stats = await db.query<{ sent: number; queued: number; failed: number }>(
      `SELECT
         count(*) FILTER (WHERE status = 'sent')::int AS sent,
         count(*) FILTER (WHERE status = 'queued')::int AS queued,
         count(*) FILTER (WHERE status = 'failed')::int AS failed
       FROM email_jobs
       WHERE created_at >= now() - interval '30 days'`,
    );
    const jobs = await db.query(
      `SELECT j.id, j.to_email, j.to_name, j.subject, j.status, j.scheduled_at, j.sent_at, j.last_error, r.nome AS regra
       FROM email_jobs j
       JOIN email_rules r ON r.id = j.rule_id
       ORDER BY coalesce(j.sent_at, j.scheduled_at) DESC
       LIMIT 80`,
    );
    return { stats: stats.rows[0] ?? { sent: 0, queued: 0, failed: 0 }, jobs: jobs.rows };
  });

  app.post("/v1/events", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    if (!isEmail(parsed.data.payload.email)) return reply.code(400).send({ error: "email inválido" });
    try {
      const result = await ingestEvent(db, parsed.data.type, parsed.data.payload, parsed.data.idempotencyKey);
      await processDueJobs(db).catch(() => undefined);
      await audit(db, req.actor!.id, "automation.event", parsed.data.type, result.eventId ?? undefined, req.ip, {
        queued: result.queued,
        duplicate: result.duplicate,
      });
      return result;
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "evento recusado" });
    }
  });

  if (opts.worker !== false && !onVercel) {
    const tick = async () => {
      try { await processDueJobs(db); }
      catch (err) { app.log.error(err); }
    };
    const timer = setInterval(tick, 2500);
    timer.unref();
    app.addHook("onClose", async () => clearInterval(timer));
    setTimeout(tick, 400).unref();
  }

  return app;
}
