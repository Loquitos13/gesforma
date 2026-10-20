import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { sessoesAtivasDe, terminarSessoesDe } from "../repos/sessoes.js";
import {
  PERFIS, actualizarUtilizador, apagarUtilizador, criarUtilizador, definirPalavraPasse, eUltimoAdmin,
  eViolacaoUnica, listarUtilizadores, obterUtilizador, type LinhaUtilizador,
} from "../repos/utilizadores.js";
import { hashPassword, isEmail, normalizeEmail } from "../security.js";
import { textoQuery, validar } from "../validacao.js";
import { mensagemPalavraPasse, palavraPasseValida } from "../../../src/partilhado/passwordPolicy.js";
import type { Deps } from "./tipos.js";

// Gestão de utilizadores (só administração), em `/v1/utilizadores`.

const uuidParam = z.object({ id: z.string().uuid() });
const criarSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().max(254),
  password: z.string().min(1).max(200),
  role: z.enum(PERFIS).default("secretaria"),
  active: z.boolean().optional().default(true),
  mustChangePassword: z.boolean().optional().default(true),
});
const alterarSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().max(254).optional(),
  role: z.enum(PERFIS).optional(),
  active: z.boolean().optional(),
}).refine(v => Object.keys(v).length > 0, { message: "sem alterações" });
const passwordSchema = z.object({
  password: z.string().min(1).max(200),
  revokeSessions: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
});
const listaQuery = z.object({
  perfil: z.preprocess(v => (v === "" ? undefined : v), z.enum(PERFIS).optional()),
  estado: z.preprocess(v => (v === "" ? undefined : v), z.enum(["ativos", "inativos"]).optional()),
  q: textoQuery(120),
});

function mapear(u: LinhaUtilizador) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    mustChangePassword: Boolean(u.must_change_password),
    created_at: u.created_at,
    last_login_at: u.last_login_at,
    sessions_open: Number(u.sessions_open) || 0,
  };
}

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  function soAdmin(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return false;
    if (req.actor?.role !== "admin") {
      reply.code(403).send({ error: "só a administração gere utilizadores" });
      return false;
    }
    return true;
  }

  const base = "/v1/utilizadores";
  app.get(base, async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    const v = validar(reply, { query: listaQuery }, req);
    if (!v) return;
    const { linhas, contagens } = await listarUtilizadores(db, v.query);
    return { users: linhas.map(mapear), contagens };
  });

  app.get(`${base}/:id`, async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    const v = validar(reply, { params: uuidParam }, req);
    if (!v) return;
    const u = await obterUtilizador(db, v.params.id);
    if (!u) return reply.code(404).send({ error: "utilizador não encontrado" });
    return { user: mapear(u), sessoes: await sessoesAtivasDe(db, v.params.id) };
  });

  app.post(base, { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    const v = validar(reply, { body: criarSchema }, req);
    if (!v) return;
    const email = normalizeEmail(v.body.email);
    if (!isEmail(email)) return reply.code(400).send({ error: "email inválido" });
    if (!palavraPasseValida(v.body.password)) return reply.code(400).send({ error: mensagemPalavraPasse(v.body.password) });
    const id = randomUUID();
    try {
      await criarUtilizador(db, {
        id, name: v.body.name, email, passwordHash: await hashPassword(v.body.password), role: v.body.role,
        active: v.body.active, mustChangePassword: v.body.mustChangePassword,
      });
    } catch (err) {
      if (eViolacaoUnica(err)) return reply.code(409).send({ error: "já existe um utilizador com este email" });
      throw err;
    }
    await audit(db, req.actor!.id, "user.create", "user", id, req.ip, { email, role: v.body.role });
    const u = await obterUtilizador(db, id);
    return { user: u ? mapear(u) : null };
  });

  app.patch(`${base}/:id`, async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    const v = validar(reply, { params: uuidParam, body: alterarSchema }, req);
    if (!v) return;
    const id = v.params.id;
    const atual = await obterUtilizador(db, id);
    if (!atual) return reply.code(404).send({ error: "utilizador não encontrado" });
    const role = v.body.role ?? atual.role;
    const active = v.body.active ?? atual.active;
    if (id === req.actor!.id && active === false) return reply.code(400).send({ error: "não pode desactivar a sua própria conta" });
    let email: string | undefined;
    if (v.body.email !== undefined) {
      email = normalizeEmail(v.body.email);
      if (!isEmail(email)) return reply.code(400).send({ error: "email inválido" });
    }
    try {
      // Verificação do último admin e escrita na mesma transacção (ver adminsAtivosBloqueados).
      const feito = await db.tx(async q => {
        if ((role !== "admin" || !active) && (await eUltimoAdmin(q, id))) return false;
        await actualizarUtilizador(q, id, { ...v.body, email });
        return true;
      });
      if (!feito) return reply.code(409).send({ error: "tem de ficar pelo menos um administrador activo" });
    } catch (err) {
      if (eViolacaoUnica(err)) return reply.code(409).send({ error: "já existe um utilizador com este email" });
      throw err;
    }
    if (active === false) await terminarSessoesDe(db, id);
    await audit(db, req.actor!.id, "user.update", "user", id, req.ip, { role, active, antes: { role: atual.role, active: atual.active } });
    const u = await obterUtilizador(db, id);
    return { user: u ? mapear(u) : null };
  });

  app.post(`${base}/:id/password`, { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    const v = validar(reply, { params: uuidParam, body: passwordSchema }, req);
    if (!v) return;
    if (!palavraPasseValida(v.body.password)) return reply.code(400).send({ error: mensagemPalavraPasse(v.body.password) });
    if (!(await obterUtilizador(db, v.params.id))) return reply.code(404).send({ error: "utilizador não encontrado" });
    await definirPalavraPasse(db, v.params.id, await hashPassword(v.body.password), { mudarNoProximo: v.body.mustChangePassword ?? true });
    if (v.body.revokeSessions) await terminarSessoesDe(db, v.params.id);
    await audit(db, req.actor!.id, "user.password", "user", v.params.id, req.ip, { revokeSessions: Boolean(v.body.revokeSessions) });
    return { ok: true };
  });

  app.post(`${base}/:id/terminar-sessoes`, { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    const v = validar(reply, { params: uuidParam }, req);
    if (!v) return;
    if (!(await obterUtilizador(db, v.params.id))) return reply.code(404).send({ error: "utilizador não encontrado" });
    const terminadas = await terminarSessoesDe(db, v.params.id);
    await audit(db, req.actor!.id, "user.sessions_revoke", "user", v.params.id, req.ip, { terminadas });
    return { ok: true, terminadas, propria: v.params.id === req.actor!.id };
  });

  app.delete(`${base}/:id`, async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    const v = validar(reply, { params: uuidParam }, req);
    if (!v) return;
    const id = v.params.id;
    if (id === req.actor!.id) return reply.code(400).send({ error: "não pode eliminar a sua própria conta" });
    const atual = await obterUtilizador(db, id);
    if (!atual) return reply.code(404).send({ error: "utilizador não encontrado" });
    const apagado = await db.tx(async q => {
      if (await eUltimoAdmin(q, id)) return false;
      await apagarUtilizador(q, id);
      return true;
    });
    if (!apagado) return reply.code(409).send({ error: "tem de ficar pelo menos um administrador activo" });
    await audit(db, req.actor!.id, "user.delete", "user", id, req.ip, { email: atual.email, role: atual.role });
    return { ok: true };
  });
}
