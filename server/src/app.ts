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
  dbCreateCatalogo,
  dbCreateCurso,
  dbCreateEmailRule,
  dbCreateFormador,
  dbCreateFormandoFin,
  dbCreateFormandoTurma,
  dbCreateInquerito,
  dbCreatePreinscricao,
  dbCreateSession,
  dbCreateTransacao,
  dbCreateTurma,
  dbDeleteCatalogo,
  dbDeleteCurso,
  dbDeleteEmailRule,
  dbDeleteFormador,
  dbDeleteFormandoFin,
  dbDeleteFormandoTurma,
  dbDeletePreinscricao,
  dbDeleteSession,
  dbDeleteTurma,
  dbGetCatalogo,
  dbGetConfiguracoes,
  dbGetCursos,
  dbGetDtp,
  dbGetEmailJobs,
  dbGetEmailJobStats,
  dbGetEmailRules,
  dbGetEmailTemplateById,
  dbGetEmailTemplateByTipo,
  dbGetEmailTemplates,
  dbGetFicheiro,
  dbGetFormadores,
  dbGetFormandosFin,
  dbGetFormandosTurmas,
  dbGetInqueritos,
  dbGetNotificacoes,
  dbGetPreinscricoes,
  dbGetSessionUser,
  dbGetTransacoes,
  dbGetTurmaForExport,
  dbGetTurmas,
  dbGetUserByEmail,
  dbInsertAuditLog,
  dbMarcarNotificacaoLida,
  dbMarcarTodasNotificacoesLidas,
  dbResponderInquerito,
  dbSaveConfiguracao,
  dbSaveDtp,
  dbSaveFicheiro,
  dbToggleTurma,
  dbUpdateCurso,
  dbUpdateEmailRule,
  dbUpdateEmailTemplate,
  dbUpdateFormador,
  dbUpdateFormandoFin,
  dbUpdateFormandoTurma,
  dbUpdatePreinscricao,
  dbUpdateTransacao,
  dbUpdateTurma,
  dbUpdateTurmaCronograma,
} from "./db/repository.js";
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
  cta: z.string().trim().min(1).max(120).optional(),
  cta_href: z.string().trim().min(1).max(500).optional(),
  cta_ambito: z.enum(["preinscricao", "plataforma"]).optional(),
});

function clientOk(req: FastifyRequest) {
  const origin = req.headers.origin;
  if (origin) return allowedOrigins().has(origin);
  return req.headers["x-gesforma-client"] === "web";
}

async function audit(db: Db, actorId: string | undefined, action: string, entity: string, entityId?: string, ip?: string, meta: Record<string, unknown> = {}) {
  await dbInsertAuditLog(db, actorId, action, entity, entityId, ip, meta);
}

export async function buildApp(db: Db, opts: { worker?: boolean } = {}) {
  const app = Fastify({
    logger: true,
    trustProxy: config.trustProxy,
    bodyLimit: 25 * 1024 * 1024,
    requestTimeout: 20_000,
    disableRequestLogging: false,
  });
  app.decorate("db", db);

  app.setErrorHandler((error: any, request, reply) => {
    request.log.error(error);
    const code = Number(error?.statusCode ?? 500);
    const msg = code < 500 ? String(error?.message || "Erro") : "Pedido recusado pelo servidor";
    reply.status(code).send({ error: msg });
  });

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
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "X-Gesforma-Client"],
    maxAge: 600,
  });
  await app.register(cookie, { secret: config.sessionSecret });
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
    allowList: ["/health", "/v1/pagamentos/webhook"],
  });

  app.addHook("onRequest", async (req, reply) => {
    if (req.method !== "GET" && req.method !== "HEAD" && req.url !== "/health") {
      if (req.url.startsWith("/v1/pagamentos/webhook") || req.url.includes("/responder")) {
        return;
      }
      if (!clientOk(req)) {
        return reply.code(403).send({ error: "origem recusada" });
      }
    }
  });

  app.addHook("preHandler", async (req) => {
    const raw = req.cookies[config.cookieName];
    if (!raw) return;
    const hash = sha256(raw);
    const user = await dbGetSessionUser(db, hash);
    if (user) req.actor = user;
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

  // Auth
  app.post("/v1/auth/login", {
    config: { rateLimit: { max: 8, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const email = normalizeEmail(parsed.data.email);
    if (!isEmail(email)) return reply.code(400).send({ error: "credenciais inválidas" });
    const row = await dbGetUserByEmail(db, email);
    const dummy = "scrypt$16384$8$1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";
    const ok = await verifyPassword(parsed.data.password, row?.password_hash ?? dummy);
    if (!row || !row.active || !ok) {
      await audit(db, row?.id, "auth.login_failed", "user", row?.id, req.ip);
      return reply.code(401).send({ error: "credenciais inválidas" });
    }
    const token = newToken();
    const exp = new Date(Date.now() + config.sessionDays * 86400_000).toISOString();
    await dbCreateSession(db, {
      id: randomUUID(),
      userId: row.id,
      tokenHash: sha256(token),
      expiresAt: exp,
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] ?? "").slice(0, 180),
    });
    setSessionCookie(reply, token, config.sessionDays);
    await audit(db, row.id, "auth.login", "user", row.id, req.ip);
    return { user: { id: row.id, email, name: row.name, role: row.role } };
  });

  app.post("/v1/auth/logout", async (req, reply) => {
    const raw = req.cookies[config.cookieName];
    if (raw) await dbDeleteSession(db, sha256(raw));
    reply.clearCookie(config.cookieName, { path: "/" });
    if (req.actor) await audit(db, req.actor.id, "auth.logout", "user", req.actor.id, req.ip);
    return { ok: true };
  });

  app.get("/v1/me", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return { user: req.actor };
  });

  // Email Templates
  app.get("/v1/email/templates", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await dbGetEmailTemplates(db);
    return { templates: rows };
  });

  app.patch("/v1/email/templates/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = templatePatchSchema.safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const patch = parsed.data;
    await dbUpdateEmailTemplate(db, id, patch);
    await audit(db, req.actor!.id, "email.template_update", "email_template", String(id), req.ip);
    const row = await dbGetEmailTemplateById(db, id);
    return { template: row };
  });

  // Email Rules
  app.get("/v1/email/rules", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await dbGetEmailRules(db);
    return {
      rules: rows.map(r => ({
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
    const tpl = await dbGetEmailTemplateByTipo(db, parsed.data.templateTipo);
    if (!tpl) return reply.code(400).send({ error: "template desconhecido" });
    const inserted = await dbCreateEmailRule(db, {
      nome: parsed.data.nome,
      triggerKey: key,
      gatilhoLabel: parsed.data.gatilho,
      templateTipo: parsed.data.templateTipo,
      delaySeconds: delaySecondsFromLabel(parsed.data.atraso ?? "Imediatamente"),
      curso: parsed.data.curso || null,
      ativo: parsed.data.ativo ?? true,
    });
    await audit(db, req.actor!.id, "email.rule_create", "email_rule", String(inserted.id), req.ip);
    return { id: inserted.id };
  });

  app.patch("/v1/email/rules/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = ruleSchema.partial().safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const key = d.gatilho ? TRIGGER_MAP[d.gatilho] : undefined;
    if (d.gatilho && !key) return reply.code(400).send({ error: "gatilho desconhecido" });
    await dbUpdateEmailRule(db, id, {
      nome: d.nome,
      gatilhoLabel: d.gatilho,
      triggerKey: key,
      templateTipo: d.templateTipo,
      delaySeconds: d.atraso != null ? delaySecondsFromLabel(d.atraso) : null,
      curso: d.curso === undefined ? null : (d.curso || null),
      ativo: d.ativo,
    });
    await audit(db, req.actor!.id, "email.rule_update", "email_rule", String(id), req.ip);
    return { ok: true };
  });

  app.delete("/v1/email/rules/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: "pedido inválido" });
    await dbDeleteEmailRule(db, id);
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
    const stats = await dbGetEmailJobStats(db);
    const jobs = await dbGetEmailJobs(db, 80);
    return { stats, jobs };
  });

  // Events / Automations
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

  // Formadores
  app.get("/v1/formadores", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const formadores = await dbGetFormadores(db);
    return { formadores };
  });

  app.post("/v1/formadores", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = req.body as Record<string, any>;
    const formador = await dbCreateFormador(db, body);
    await audit(db, req.actor!.id, "formador.create", "formadores", String(formador.id), req.ip);
    return { formador };
  });

  app.patch("/v1/formadores/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await dbUpdateFormador(db, id, req.body as Record<string, any>);
    await audit(db, req.actor!.id, "formador.update", "formadores", String(id), req.ip);
    return { ok: true };
  });

  app.delete("/v1/formadores/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await dbDeleteFormador(db, id);
    await audit(db, req.actor!.id, "formador.delete", "formadores", String(id), req.ip);
    return { ok: true };
  });

  // Cursos
  app.get("/v1/cursos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const cursos = await dbGetCursos(db);
    return { cursos };
  });

  app.post("/v1/cursos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const curso = await dbCreateCurso(db, req.body as Record<string, any>);
    await audit(db, req.actor!.id, "curso.create", "cursos", String(curso.id), req.ip);
    return { curso };
  });

  app.patch("/v1/cursos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await dbUpdateCurso(db, id, req.body as Record<string, any>);
    await audit(db, req.actor!.id, "curso.update", "cursos", String(id), req.ip);
    return { ok: true };
  });

  app.delete("/v1/cursos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await dbDeleteCurso(db, id);
    await audit(db, req.actor!.id, "curso.delete", "cursos", String(id), req.ip);
    return { ok: true };
  });

  // Turmas
  app.get("/v1/turmas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return dbGetTurmas(db);
  });

  app.post("/v1/turmas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const turma = await dbCreateTurma(db, req.body as Record<string, any>);
    await audit(db, req.actor!.id, "turma.create", "turmas", String(turma.id), req.ip);
    return { turma };
  });

  app.patch("/v1/turmas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await dbUpdateTurma(db, id, req.body as Record<string, any>);
    await audit(db, req.actor!.id, "turma.update", "turmas", String(id), req.ip);
    return { ok: true };
  });

  app.put("/v1/turmas/:id/cronograma", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const b = req.body as { cronograma: any[] };
    await dbUpdateTurmaCronograma(db, id, b.cronograma || []);
    await audit(db, req.actor!.id, "turma.cronograma_update", "turmas", String(id), req.ip);
    return { ok: true };
  });

  app.patch("/v1/turmas/:id/toggle", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const b = req.body as { activa: boolean };
    await dbToggleTurma(db, id, b.activa);
    await audit(db, req.actor!.id, "turma.toggle", "turmas", String(id), req.ip);
    return { ok: true };
  });

  app.delete("/v1/turmas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await dbDeleteTurma(db, id);
    await audit(db, req.actor!.id, "turma.delete", "turmas", String(id), req.ip);
    return { ok: true };
  });

  // Pré-inscrições
  app.get("/v1/preinscricoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const preinscricoes = await dbGetPreinscricoes(db);
    return { preinscricoes };
  });

  app.post("/v1/preinscricoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const b = req.body as Record<string, any>;
    const id = await dbCreatePreinscricao(db, b);
    if (b.email) {
      void ingestEvent(db, "preinscricao.created", {
        email: b.email,
        nome: `${b.nome || ""} ${b.apelido || ""}`.trim(),
        curso: b.curso || "",
      }, `preinscricao:${id}:${b.email}`).catch(() => undefined);
    }
    await audit(db, req.actor!.id, "preinscricao.create", "preinscricoes", String(id), req.ip);
    return { id };
  });

  app.patch("/v1/preinscricoes/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await dbUpdatePreinscricao(db, id, req.body as Record<string, any>);
    await audit(db, req.actor!.id, "preinscricao.update", "preinscricoes", String(id), req.ip);
    return { ok: true };
  });

  app.delete("/v1/preinscricoes/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await dbDeletePreinscricao(db, id);
    await audit(db, req.actor!.id, "preinscricao.delete", "preinscricoes", String(id), req.ip);
    return { ok: true };
  });

  // Formandos Turmas
  app.get("/v1/formandos-turmas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const formandosTurmas = await dbGetFormandosTurmas(db);
    return { formandosTurmas };
  });

  app.post("/v1/formandos-turmas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = await dbCreateFormandoTurma(db, req.body as Record<string, any>);
    await audit(db, req.actor!.id, "formando_turma.create", "formandos_turmas", String(id), req.ip);
    return { id };
  });

  app.patch("/v1/formandos-turmas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await dbUpdateFormandoTurma(db, id, req.body as Record<string, any>);
    await audit(db, req.actor!.id, "formando_turma.update", "formandos_turmas", String(id), req.ip);
    return { ok: true };
  });

  app.delete("/v1/formandos-turmas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await dbDeleteFormandoTurma(db, id);
    await audit(db, req.actor!.id, "formando_turma.delete", "formandos_turmas", String(id), req.ip);
    return { ok: true };
  });

  // Formandos Financiadas
  app.get("/v1/formandos-fin", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const formandosFin = await dbGetFormandosFin(db);
    return { formandosFin };
  });

  app.post("/v1/formandos-fin", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = await dbCreateFormandoFin(db, req.body as Record<string, any>);
    await audit(db, req.actor!.id, "formando_fin.create", "formandos_fin", String(id), req.ip);
    return { id };
  });

  app.patch("/v1/formandos-fin/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await dbUpdateFormandoFin(db, id, req.body as Record<string, any>);
    await audit(db, req.actor!.id, "formando_fin.update", "formandos_fin", String(id), req.ip);
    return { ok: true };
  });

  app.delete("/v1/formandos-fin/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await dbDeleteFormandoFin(db, id);
    await audit(db, req.actor!.id, "formando_fin.delete", "formandos_fin", String(id), req.ip);
    return { ok: true };
  });

  // Transações e Pagamentos
  app.get("/v1/transacoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const transacoes = await dbGetTransacoes(db);
    return { transacoes };
  });

  app.post("/v1/transacoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const b = req.body as Record<string, any>;
    const id = await dbCreateTransacao(db, b);
    if (b.estado === "Pago" && b.email) {
      void ingestEvent(db, "payment.confirmed", {
        email: b.email,
        nome: b.nome || "Formando",
        curso: b.curso || "",
      }, `payment:${id}:${b.email}`).catch(() => undefined);
    }
    await audit(db, req.actor!.id, "transacao.create", "transacoes", id, req.ip);
    return { id, ok: true };
  });

  app.patch("/v1/transacoes/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = (req.params as { id: string }).id;
    const b = req.body as Record<string, any>;
    await dbUpdateTransacao(db, id, b);
    if (b.estado === "Pago" && b.email) {
      void ingestEvent(db, "payment.confirmed", {
        email: b.email,
        nome: b.nome || "Formando",
        curso: b.curso || "",
      }, `payment:${id}:${b.email}`).catch(() => undefined);
    }
    await audit(db, req.actor!.id, "transacao.update", "transacoes", id, req.ip);
    return { ok: true };
  });

  // Webhook para gateways de pagamento (ex: Ifthenpay, EuPago)
  app.post("/v1/pagamentos/webhook", async (req, reply) => {
    const b = req.body as { transacaoId?: string; referencia?: string; valor?: number; email?: string; nome?: string; curso?: string };
    const id = b.transacaoId || `TRX-${Date.now() % 100000}`;
    await dbCreateTransacao(db, {
      id,
      nome: b.nome || "Formando",
      valor: b.valor || 0,
      metodo: "Multibanco",
      curso: b.curso || "Formação ENA",
      estado: "Pago",
    });
    if (b.email) {
      void ingestEvent(db, "payment.confirmed", {
        email: b.email,
        nome: b.nome || "Formando",
        curso: b.curso || "",
      }, `webhook:${id}:${b.email}`).catch(() => undefined);
    }
    return { ok: true, processado: true };
  });

  // DTP (Dossiê Técnico-Pedagógico)
  app.get("/v1/dtp/:turmaId", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const turmaId = Number((req.params as { turmaId: string }).turmaId);
    const dtp = await dbGetDtp(db, turmaId);
    return { dtp };
  });

  app.put("/v1/dtp/:turmaId", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const turmaId = Number((req.params as { turmaId: string }).turmaId);
    await dbSaveDtp(db, turmaId, req.body as Record<string, any>);
    await audit(db, req.actor!.id, "dtp.update", "dtp_turmas", String(turmaId), req.ip);
    return { ok: true };
  });

  // Catálogos e Itens Gerais
  app.get("/v1/catalogo/:tipo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const tipo = (req.params as { tipo: string }).tipo;
    const items = await dbGetCatalogo(db, tipo);
    return { items };
  });

  app.post("/v1/catalogo/:tipo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const tipo = (req.params as { tipo: string }).tipo;
    const item = await dbCreateCatalogo(db, tipo, req.body as Record<string, any>);
    return item;
  });

  app.delete("/v1/catalogo/:tipo/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await dbDeleteCatalogo(db, id);
    return { ok: true };
  });

  // Notificações
  app.get("/v1/notificacoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const notificacoes = await dbGetNotificacoes(db);
    return { notificacoes };
  });

  app.patch("/v1/notificacoes/:id/lida", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await dbMarcarNotificacaoLida(db, id);
    return { ok: true };
  });

  app.post("/v1/notificacoes/marcar-todas-lidas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await dbMarcarTodasNotificacoesLidas(db);
    return { ok: true };
  });

  // Configurações
  app.get("/v1/configuracoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const configuracoes = await dbGetConfiguracoes(db);
    return { configuracoes };
  });

  app.put("/v1/configuracoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const b = req.body as { id: string; dados: Record<string, any> };
    await dbSaveConfiguracao(db, b.id, b.dados || {});
    await audit(db, req.actor!.id, "config.update", "configuracoes", b.id, req.ip);
    return { ok: true };
  });

  // Inquéritos
  app.get("/v1/inqueritos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const inqueritos = await dbGetInqueritos(db);
    return { inqueritos };
  });

  app.post("/v1/inqueritos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const inquerito = await dbCreateInquerito(db, req.body as Record<string, any>);
    return { inquerito };
  });

  app.post("/v1/inqueritos/:id/responder", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const b = req.body as { respostas: any[] };
    await dbResponderInquerito(db, id, b.respostas || []);
    return { ok: true };
  });

  // Ficheiros (Upload & Armazenamento Seguro)
  app.post("/v1/ficheiros/upload", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const b = req.body as { nome: string; mimeType?: string; base64: string; contexto?: string; referenciaId?: string };
    if (!b.nome || !b.base64) return reply.code(400).send({ error: "dados de ficheiro incompletos" });
    const id = randomUUID();
    const tamanho = Math.round((b.base64.length * 3) / 4);
    await dbSaveFicheiro(db, {
      id,
      nome: b.nome,
      mimeType: b.mimeType || "application/octet-stream",
      tamanho,
      base64: b.base64,
      contexto: b.contexto,
      referenciaId: b.referenciaId,
    });
    await audit(db, req.actor!.id, "ficheiro.upload", "ficheiros", id, req.ip, { nome: b.nome, tamanho });
    return { id, nome: b.nome, tamanho, url: `/v1/ficheiros/${id}` };
  });

  app.get("/v1/ficheiros/:id", async (req, reply) => {
    const id = (req.params as { id: string }).id;
    const row = await dbGetFicheiro(db, id);
    if (!row) return reply.code(404).send({ error: "ficheiro não encontrado" });
    const buf = Buffer.from(row.base64_data.replace(/^data:[^;]+;base64,/, ""), "base64");
    reply.header("Content-Type", row.mime_type);
    reply.header("Content-Disposition", `attachment; filename="${encodeURIComponent(row.nome)}"`);
    return reply.send(buf);
  });

  // Exportação Real de Turmas
  app.get("/v1/turmas/:id/export/:pack", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const pack = (req.params as { pack: string }).pack;
    const data = await dbGetTurmaForExport(db, id);
    if (!data) return reply.code(404).send({ error: "turma não encontrada" });
    const { turma, formandos, dtp } = data;

    if (pack === "formandos") {
      const csvLines = [
        "Nome,Apelido,Email,Telefone,Estado,Pago,Valor,Metodo",
        ...formandos.map(f => `"${f.nome}","${f.apelido}","${f.email}","${f.telf}","${f.estado}","${f.pago ? 'Sim' : 'Nao'}","${f.valor}","${f.metodo}"`),
      ];
      reply.header("Content-Type", "text/csv; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="formandos-${turma.nome}.csv"`);
      return reply.send(csvLines.join("\n"));
    }

    if (pack === "presencas") {
      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Folha de Presenças - ${turma.nome}</title>
<style>
body { font-family: sans-serif; padding: 20px; color: #1e293b; }
h1 { font-size: 18px; margin-bottom: 4px; }
table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
th { background: #f1f5f9; }
.sig { width: 220px; }
</style>
</head>
<body>
<h1>ENA - Escola de Negócios e Administração</h1>
<p>Turma: <strong>${turma.nome}</strong> | Curso: <strong>${turma.curso}</strong> | Local: <strong>${turma.local}</strong></p>
<table>
<thead><tr><th>N.º</th><th>Nome do Formando</th><th>Presença</th><th class="sig">Assinatura</th></tr></thead>
<tbody>
${formandos.map((f, i) => `<tr><td>${i + 1}</td><td>${f.nome} ${f.apelido}</td><td>[ ] Presente</td><td></td></tr>`).join("")}
</tbody>
</table>
</body>
</html>`;
      reply.header("Content-Type", "text/html; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="presencas-${turma.nome}.html"`);
      return reply.send(html);
    }

    if (pack === "cronograma") {
      const crono = Array.isArray(turma.cronograma) ? turma.cronograma : [];
      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Cronograma - ${turma.nome}</title>
<style>
body { font-family: sans-serif; padding: 20px; color: #1e293b; }
h1 { font-size: 18px; margin-bottom: 4px; }
table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
th { background: #f1f5f9; }
</style>
</head>
<body>
<h1>ENA - Cronograma de Formação</h1>
<p>Turma: <strong>${turma.nome}</strong> | Curso: <strong>${turma.curso}</strong></p>
<table>
<thead><tr><th>Sessão</th><th>Data</th><th>Horário</th><th>Módulos</th><th>Formador</th></tr></thead>
<tbody>
${crono.map((s: any, i: number) => `<tr><td>Sessão ${i + 1}</td><td>${s.data || '-'}</td><td>${s.horaInicio || '09:00'} - ${s.horaFim || '13:00'}</td><td>${(s.modulos || []).join(", ") || '-'}</td><td>${(s.formadores || []).join(", ") || '-'}</td></tr>`).join("")}
</tbody>
</table>
</body>
</html>`;
      reply.header("Content-Type", "text/html; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="cronograma-${turma.nome}.html"`);
      return reply.send(html);
    }

    reply.header("Content-Type", "application/json");
    reply.header("Content-Disposition", `attachment; filename="dtp-${turma.nome}.json"`);
    return reply.send({ turma, dtp });
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
