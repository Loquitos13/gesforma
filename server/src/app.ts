import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { processDueJobs } from "./automations.js";
import { enviarLembretesPreinscricao } from "./lembretePre.js";
import { allowedOrigins, config, onVercel } from "./config.js";
import { enterActor, medirPedido, type Db, type Medicao } from "./db/pool.js";
import { sha256 } from "./security.js";
import { classifyRoute } from "./routeAuth.js";
import { podeAceder } from "./permissoes.js";
import { linhaCrmDoCaminho } from "./permissoes/crm.js";
import { linhaVisivel } from "./repos/crmVisivel.js";
import { invalidarDtp } from "./pedagogia/dtpCache.js";
import { registarRotas } from "./rotas/index.js";
import { registarAuditoria as audit } from "./repos/auditoria.js";
import { actorDaSessao } from "./repos/sessoes.js";
import { LogCompacto } from "./logCompacto.js";
import { pingBase } from "./repos/sistema.js";

declare module "fastify" {
  interface FastifyInstance { db: Db }
  interface FastifyRequest { consultas?: Medicao }
  interface FastifyRequest {
    actor?: { id: string; email: string; name: string; role: string; mustChangePassword?: boolean };
  }
}

function clientOk(req: FastifyRequest) {
  const origin = req.headers.origin;
  if (origin) return allowedOrigins().has(origin);
  return req.headers["x-gesforma-client"] === "web";
}

export async function buildApp(db: Db, opts: { worker?: boolean } = {}) {
  const app = Fastify({
    logger: !process.env.VITEST,
    trustProxy: config.trustProxy,
    bodyLimit: 32 * 1024,
    requestTimeout: 60_000,
    logController: new LogCompacto(),
  });
  app.decorate("db", db);

  await app.register(helmet, {
    // A CSP é posta por tipo de resposta no onSend abaixo: JSON fica fechado de todo;
    // PDFs, imagens e vídeos da Drive abrem no browser e não podem levar `default-src 'none'`.
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "no-referrer" },
  });
  app.addHook("onSend", async (_req, reply, payload) => {
    const tipo = String(reply.getHeader("content-type") ?? "");
    reply.header(
      "content-security-policy",
      tipo.includes("json") ? "default-src 'none'; frame-ancestors 'none'; base-uri 'none'" : "frame-ancestors 'self'; base-uri 'none'",
    );
    return payload;
  });
  await app.register(cors, {
    origin: (origin, cb) => {
      if (!origin || allowedOrigins().has(origin)) cb(null, true);
      else cb(new Error("origem recusada"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "X-Gesforma-Client"],
    maxAge: 600,
  });
  await app.register(multipart, {
    limits: { fileSize: config.driveMaxBytes, files: 1, fields: 12 },
  });
  await app.register(cookie, { secret: config.sessionSecret });
  // A equipa partilha o IP do escritório: com cookie de sessão o tecto por IP sobe (o limite continua por IP,
  // para um cookie inventado não abrir contadores novos). O login e as rotas públicas têm limites próprios.
  await app.register(rateLimit, {
    max: (req: FastifyRequest) => {
      const v = req.cookies?.[config.cookieName];
      return typeof v === "string" && v ? 900 : 120;
    },
    timeWindow: "1 minute",
    allowList: ["/health"],
  });

  app.addHook("onRequest", async (req, reply) => {
    const path = req.url.split("?")[0] ?? req.url;
    if (req.method !== "GET" && req.method !== "HEAD" && path !== "/health" && !path.startsWith("/v1/public/")) {
      if (!clientOk(req)) {
        return reply.code(403).send({ error: "origem recusada" });
      }
    }
  });

  app.addHook("preHandler", async (req, reply) => {
    req.consultas = medirPedido();
    enterActor(null);
    const raw = req.cookies[config.cookieName];
    if (raw) {
      const hash = sha256(raw);
      const found = await actorDaSessao(db, hash);
      if (found) {
        req.actor = {
          id: found.id,
          email: found.email,
          name: found.name,
          role: found.role,
          mustChangePassword: Boolean(found.must_change_password),
        };
        enterActor({ id: found.id, role: found.role });
      }
    }

    // O router descodifica `%xx` antes de escolher a rota: a matriz tem de ver o mesmo caminho (`/v1/%64rive` = `/v1/drive`).
    let path: string;
    try { path = decodeURI(req.url.split("?")[0] ?? req.url); } catch { return reply.code(400).send({ error: "caminho inválido" }); }
    const kind = classifyRoute(req.method, path);
    if (kind === "public") return;
    if (!req.actor) {
      return reply.code(401).send({ error: "sessão inválida" });
    }
    // Palavra-passe temporária: até a trocar, a sessão só lê quem é e muda a palavra-passe (sair é público).
    // Vale para a equipa, formadores e a área do formando no site (que usa as mesmas duas rotas).
    if (req.actor.mustChangePassword && !((req.method === "GET" && path === "/v1/me") || (req.method === "POST" && path === "/v1/auth/password"))) {
      return reply.code(403).send({ error: "Tem de mudar a palavra-passe antes de continuar.", mudarPalavraPasse: true });
    }
    if (kind === "formando" && req.actor.role !== "formando") {
      return reply.code(403).send({ error: "a área do formando não abre o GesForma" });
    }
    if (kind === "staff" && req.actor.role === "formando") {
      return reply.code(403).send({ error: "a área do formando não abre o GesForma" });
    }
    if (kind === "staff" && !podeAceder(req.actor.role, req.method, path)) {
      return reply.code(403).send({ error: "Sem permissão para esta operação." });
    }
    // Pré-inscrições, propostas e contratos: a regra do RLS também aqui (não depende da base a aplicar).
    const linha = kind === "staff" && req.actor.role !== "admin" && req.actor.role !== "secretaria" ? linhaCrmDoCaminho(path) : null;
    if (linha && !(await linhaVisivel(db, linha.tabela, linha.id, req.actor))) {
      return reply.code(404).send({ error: "registo não encontrado" });
    }
  });

  function requireAuth(req: FastifyRequest, reply: FastifyReply, opts?: { formando?: boolean }) {
    if (!req.actor) {
      reply.code(401).send({ error: "sessão inválida" });
      return false;
    }
    if (req.actor.role === "formando" && !opts?.formando) {
      reply.code(403).send({ error: "a área do formando não abre o GesForma" });
      return false;
    }
    return true;
  }


  app.get("/health", async () => ({
    ok: true,
    driver: db.driver,
    mail: config.mailMode,
    drive: Boolean(config.googleClientId && config.googleClientSecret),
    // Para confirmar que a função e a base estão na mesma região (ida e volta à base em ms).
    regiao: process.env.VERCEL_REGION ?? null,
    baseMs: await pingBase(db),
  }));

  // Escritas bem-sucedidas que podem mexer no dossiê obrigam a recalcular a vista geral.
  // Áreas que não tocam no dossiê (notificações, emails, blog, comercial, sistema…) não invalidam:
  // recalcular a matriz custa dezenas de consultas e acontecia a cada clique.
  const SEM_DTP = /^\/v1\/(notificacoes|auth|email|blog|campanhas|equipa|utilizadores|configuracoes|settings|listas|catalogos|opcoes|auditoria|sistema|apoios|whatsapp|crm\/(clientes|parceiros|propostas|modelos|contratos))(\/|\?|$)/;
  app.addHook("onSend", async (req, reply, payload) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && reply.statusCode < 400 && !SEM_DTP.test(req.url)) invalidarDtp();
    return payload;
  });

  await registarRotas(app, { db, requireAuth, audit });


  if (opts.worker !== false && !onVercel) {
    const tick = async () => {
      try { await processDueJobs(db); }
      catch (err) { app.log.error(err); }
      try { await enviarLembretesPreinscricao(db); }
      catch (err) { app.log.error(err); }
    };
    const timer = setInterval(tick, 2500);
    timer.unref();
    app.addHook("onClose", async () => clearInterval(timer));
    setTimeout(tick, 400).unref();
  }

  return app;
}
