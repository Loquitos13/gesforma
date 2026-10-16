import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config, newToken, oauthRedirectUri, onVercel, siteOriginFromHeaders } from "../config.js";
import { driveCreds, exchangeCode, googleConfigured, googleLoginAuthUrl, googleUserEmail, purgeExpiredStates } from "../googleDrive.js";
import { clearLoginFailures, checkLoginAllowed, registerLoginFailure } from "../loginRate.js";
import {
  disconnectMicrosoft, exchangeMicrosoftCode, getMicrosoftStatus, microsoftConfigured, microsoftCreds,
  microsoftLoginAuthUrl, microsoftUserEmail, saveMicrosoftConfig, tenantConfiavel, tenantDoIdToken,
} from "../microsoftAuth.js";
import { capacidadesDe } from "../permissoes/capacidades.js";
import { apagarSessaoPorToken, consumirEstadoOauth, criarEstadoOauth, criarSessao, terminarOutrasSessoes } from "../repos/sessoes.js";
import { definirPalavraPasse, hashDaPalavraPasse, utilizadorParaLogin, utilizadorPorEmail } from "../repos/utilizadores.js";
import { hashPassword, isEmail, normalizeEmail, sha256, verifyPassword } from "../security.js";
import { validar } from "../validacao.js";
import { mensagemPalavraPasse, palavraPasseValida } from "../../../src/partilhado/passwordPolicy.js";
import type { Deps } from "./tipos.js";

// Login, sessão, OAuth (Google/Microsoft) e /v1/me (com as capacidades `pode`).

const loginSchema = z.object({ email: z.string().max(254), password: z.string().min(8).max(200) });
const passwordSchema = z.object({ password: z.string().min(1).max(200), atual: z.string().max(200).optional() });
const microsoftConfigSchema = z.object({
  clientId: z.string().trim().min(12).max(200),
  clientSecret: z.string().trim().min(12).max(400).optional(),
  tenantId: z.string().trim().max(200).optional(),
});
const callbackQuery = z.object({
  code: z.string().max(4000).optional(),
  state: z.string().max(200).optional(),
  error: z.string().max(400).optional(),
}).passthrough();

/** Hash de uma palavra-passe impossível: compara-se sempre, exista ou não a conta (mesmo tempo de resposta). */
const HASH_FICTICIO = "scrypt$16384$8$1$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";

type ActorNovo = { id: string; email: string; name: string; role: string; mustChangePassword?: boolean };

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;
  const ipDe = (req: FastifyRequest) => String(req.ip ?? "127.0.0.1");

  async function abrirSessao(reply: FastifyReply, user: ActorNovo, req: FastifyRequest, accao = "auth.login") {
    const token = newToken();
    await criarSessao(db, {
      userId: user.id,
      tokenHash: sha256(token),
      expiraEm: new Date(Date.now() + config.sessionDays * 86400_000).toISOString(),
      ip: req.ip,
      userAgent: String(req.headers["user-agent"] ?? ""),
    });
    reply.setCookie(config.cookieName, token, {
      path: "/", httpOnly: true, sameSite: "lax", secure: config.isProd || onVercel, maxAge: config.sessionDays * 86400,
    });
    await audit(db, user.id, accao, "user", user.id, req.ip);
    return { user };
  }

  app.post("/v1/auth/login", {
    config: { rateLimit: { max: 12, timeWindow: "1 minute", keyGenerator: req => `login:${req.ip}` } },
  }, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const email = normalizeEmail(parsed.data.email);
    if (!isEmail(email)) return reply.code(400).send({ error: "credenciais inválidas" });
    const gate = await checkLoginAllowed(db, ipDe(req), email);
    if (!gate.ok) return reply.code(429).send({ error: `Demasiadas tentativas. Aguarde ${gate.retrySec} segundos e tente de novo.` });
    const row = await utilizadorParaLogin(db, email);
    const ok = await verifyPassword(parsed.data.password, row?.password_hash ?? HASH_FICTICIO);
    if (!row || !row.active || !ok) {
      await registerLoginFailure(db, ipDe(req), email);
      await audit(db, row?.id, "auth.login_failed", "user", row?.id, req.ip);
      return reply.code(401).send({ error: "credenciais inválidas" });
    }
    await clearLoginFailures(db, ipDe(req), email);
    return abrirSessao(reply, { id: row.id, email, name: row.name, role: row.role, mustChangePassword: Boolean(row.must_change_password) }, req);
  });

  app.post("/v1/auth/password", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!requireAuth(req, reply, { formando: true })) return;
    const v = validar(reply, { body: passwordSchema }, req);
    if (!v) return;
    if (!palavraPasseValida(v.body.password)) return reply.code(400).send({ error: mensagemPalavraPasse(v.body.password) });
    // A troca obrigatória do primeiro acesso vem logo do login com a temporária; fora disso pede-se a atual.
    if (!req.actor!.mustChangePassword) {
      const ok = await verifyPassword(v.body.atual ?? "", (await hashDaPalavraPasse(db, req.actor!.id)) ?? HASH_FICTICIO);
      if (!ok) return reply.code(400).send({ error: "A palavra-passe atual não está certa." });
    }
    await definirPalavraPasse(db, req.actor!.id, await hashPassword(v.body.password), { mudarNoProximo: false });
    await terminarOutrasSessoes(db, req.actor!.id, sha256(String(req.cookies[config.cookieName] ?? "")));
    await audit(db, req.actor!.id, "auth.password_self", "user", req.actor!.id, req.ip);
    req.actor!.mustChangePassword = false;
    return { ok: true, user: { ...req.actor, mustChangePassword: false } };
  });

  app.post("/v1/auth/logout", async (req, reply) => {
    const raw = req.cookies[config.cookieName];
    if (raw) await apagarSessaoPorToken(db, sha256(raw));
    reply.clearCookie(config.cookieName, { path: "/" });
    if (req.actor) await audit(db, req.actor.id, "auth.logout", "user", req.actor.id, req.ip);
    return { ok: true };
  });

  app.get("/v1/me", async (req, reply) => {
    if (!requireAuth(req, reply, { formando: true })) return;
    return { user: req.actor, pode: capacidadesDe(req.actor!.role) };
  });

  // ─── OAuth: entrar com Google ou Microsoft (só contas que já existem) ─────────

  /** Termina o OAuth: encontra a conta pelo email e abre sessão. */
  async function entrarPorEmail(req: FastifyRequest, reply: FastifyReply, emailBruto: string, origem: "google" | "microsoft", fail: (r: string) => unknown, destino: string) {
    const email = normalizeEmail(emailBruto);
    if (!isEmail(email)) return fail("oauth-falhou");
    const found = await utilizadorPorEmail(db, email);
    if (!found) {
      await audit(db, undefined, `auth.${origem}_denied`, "user", email, req.ip);
      return fail("sem-conta");
    }
    if (!found.active) {
      await audit(db, found.id, `auth.${origem}_denied`, "user", found.id, req.ip);
      return fail("inactivo");
    }
    await abrirSessao(reply, { id: found.id, email, name: found.name, role: found.role }, req, `auth.${origem}`);
    return reply.redirect(destino);
  }

  const googleCallbackUri = (req: FastifyRequest) =>
    oauthRedirectUri(req.headers, "/api/v1/auth/google/callback", process.env.GOOGLE_LOGIN_REDIRECT_URI ?? "");

  app.get("/v1/auth/google", async req => {
    const creds = await driveCreds(db);
    return { configured: googleConfigured(creds), redirectUri: googleCallbackUri(req) };
  });

  app.get("/v1/auth/google/start", { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } }, async (req, reply) => {
    const origin = siteOriginFromHeaders(req.headers);
    const creds = await driveCreds(db);
    if (!googleConfigured(creds)) return reply.redirect(`${origin}/area-formando?login=sem-cliente`);
    await purgeExpiredStates(db);
    const state = newToken(24);
    const redirectUri = googleCallbackUri(req);
    await criarEstadoOauth(db, {
      state, redirectTo: `${origin}/area-formando`, expiraEm: new Date(Date.now() + 10 * 60_000).toISOString(),
      finalidade: "login", redirectUri,
    });
    return reply.redirect(googleLoginAuthUrl(state, creds, redirectUri));
  });

  app.get("/v1/auth/google/callback", async (req, reply) => {
    const origin = siteOriginFromHeaders(req.headers);
    const fail = (reason: string) => reply.redirect(`${origin}/area-formando?login=${encodeURIComponent(reason)}`);
    const q = callbackQuery.safeParse(req.query);
    if (!q.success || q.data.error) return fail("oauth-falhou");
    if (!q.data.code || !q.data.state) return fail("pedido-invalido");
    const st = await consumirEstadoOauth(db, q.data.state);
    if (!st || st.purpose !== "login") return fail("pedido-invalido");
    try {
      const creds = await driveCreds(db);
      if (!googleConfigured(creds)) return fail("sem-cliente");
      const tokens = await exchangeCode(q.data.code, creds, st.oauth_redirect_uri || googleCallbackUri(req));
      return await entrarPorEmail(req, reply, (await googleUserEmail(tokens.access_token)) ?? "", "google", fail, `${origin}/area-formando`);
    } catch {
      return fail("oauth-falhou");
    }
  });

  app.get("/v1/auth/microsoft", async req => {
    const creds = await microsoftCreds(db);
    // O ecrã de login precisa de saber se o botão está activo antes de haver sessão.
    if (req.actor?.role !== "admin") return { configured: microsoftConfigured(creds), redirectUri: creds.redirectUri };
    return getMicrosoftStatus(db);
  });

  app.put("/v1/auth/microsoft/config", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor!.role !== "admin") return reply.code(403).send({ error: "só a administração configura o login Microsoft" });
    const v = validar(reply, { body: microsoftConfigSchema }, req);
    if (!v) return;
    try {
      await saveMicrosoftConfig(db, v.body);
      await audit(db, req.actor!.id, "auth.microsoft_config", "microsoft_config", "microsoft", req.ip);
      return getMicrosoftStatus(db);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "configuração recusada" });
    }
  });

  app.post("/v1/auth/microsoft/disconnect", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor!.role !== "admin") return reply.code(403).send({ error: "só a administração configura o login Microsoft" });
    await disconnectMicrosoft(db);
    await audit(db, req.actor!.id, "auth.microsoft_disconnect", "microsoft_config", "microsoft", req.ip);
    return getMicrosoftStatus(db);
  });

  app.get("/v1/auth/microsoft/start", { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } }, async (_req, reply) => {
    const origin = config.appOrigin.replace(/\/$/, "");
    const creds = await microsoftCreds(db);
    if (!microsoftConfigured(creds)) return reply.redirect(`${origin}/area-formando?login=sem-cliente-microsoft`);
    await purgeExpiredStates(db);
    const state = newToken(24);
    await criarEstadoOauth(db, {
      state, redirectTo: `${origin}/area-formando`, expiraEm: new Date(Date.now() + 10 * 60_000).toISOString(), finalidade: "login-microsoft",
    });
    return reply.redirect(microsoftLoginAuthUrl(state, creds));
  });

  app.get("/v1/auth/microsoft/callback", async (req, reply) => {
    const origin = config.appOrigin.replace(/\/$/, "");
    const fail = (reason: string) => reply.redirect(`${origin}/area-formando?login=${encodeURIComponent(reason)}`);
    const q = callbackQuery.safeParse(req.query);
    if (!q.success || q.data.error) return fail("oauth-falhou");
    if (!q.data.code || !q.data.state) return fail("pedido-invalido");
    const st = await consumirEstadoOauth(db, q.data.state);
    if (!st || st.purpose !== "login-microsoft") return fail("pedido-invalido");
    try {
      const creds = await microsoftCreds(db);
      if (!microsoftConfigured(creds)) return fail("sem-cliente-microsoft");
      const tokens = await exchangeMicrosoftCode(q.data.code, creds);
      // Fora do tenant da ENA (e das contas pessoais) o `mail` é escolhido por quem gere esse tenant e não prova
      // identidade de ninguém, nem de um formando: recusa (entra-se com a palavra-passe).
      if (!tenantConfiavel(tenantDoIdToken(tokens.id_token), creds.tenantId)) return fail("tenant-recusado");
      return await entrarPorEmail(req, reply, (await microsoftUserEmail(tokens.access_token)) ?? "", "microsoft", fail, `${origin}/area-formando`);
    } catch {
      return fail("oauth-falhou");
    }
  });
}
