import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import * as repo from "../repos/testemunhos.js";
import { idNum, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

// Testemunhos: o formando deixa a sua opinião na área do formando; a administração aprova; o site mostra os aprovados.

const testemunhoSchema = z.object({
  nome: z.string().trim().min(2).max(60),
  curso: z.string().trim().max(160).default(""),
  texto: z.string().trim().min(10, "Escreva pelo menos uma frase.").max(1200),
  estrelas: z.number().int().min(1).max(5),
  autorizaPublicar: z.boolean(),
});
const revisaoSchema = z.object({ estado: z.enum(["aprovado", "recusado", "pendente"]) });
const filtroSchema = z.object({ estado: z.enum(["pendente", "aprovado", "recusado"]).optional() });

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  function soFormando(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply, { formando: true })) return false;
    if (req.actor!.role !== "formando") {
      reply.code(403).send({ error: "só o formando deixa o seu testemunho" });
      return false;
    }
    return true;
  }

  // ─── O formando, na área do formando ──────────────────────────────────────
  app.get("/v1/area-formando/testemunho", async (req, reply) => {
    if (!soFormando(req, reply)) return;
    return { testemunho: await repo.doUtilizador(db, req.actor!.id) };
  });

  app.put("/v1/area-formando/testemunho", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!soFormando(req, reply)) return;
    const v = validar(reply, { body: testemunhoSchema }, req);
    if (!v) return;
    const t = await repo.gravarDoUtilizador(db, req.actor!.id, v.body);
    await audit(db, req.actor!.id, "testemunho.gravar", "testemunho", String(t?.id ?? ""), req.ip);
    return { testemunho: t };
  });

  app.delete("/v1/area-formando/testemunho", async (req, reply) => {
    if (!soFormando(req, reply)) return;
    await repo.apagarDoUtilizador(db, req.actor!.id);
    return { ok: true };
  });

  // ─── Revisão no backoffice (matriz: só admin, em permissoes/site.ts) ───────
  app.get("/v1/testemunhos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: filtroSchema }, req);
    if (!v) return;
    return { testemunhos: await repo.listar(db, v.query.estado) };
  });

  app.patch("/v1/testemunhos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: z.object({ id: idNum }), body: revisaoSchema }, req);
    if (!v) return;
    const r = await repo.rever(db, v.params.id, v.body.estado, req.actor!.id);
    if (!r) return reply.code(404).send({ error: "testemunho inexistente" });
    await audit(db, req.actor!.id, `testemunho.${v.body.estado}`, "testemunho", String(v.params.id), req.ip);
    return r;
  });

  app.delete("/v1/testemunhos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: z.object({ id: idNum }) }, req);
    if (!v) return;
    if (!(await repo.apagar(db, v.params.id))) return reply.code(404).send({ error: "testemunho inexistente" });
    await audit(db, req.actor!.id, "testemunho.apagar", "testemunho", String(v.params.id), req.ip);
    return { ok: true };
  });

  // ─── Site ─────────────────────────────────────────────────────────────────
  app.get("/v1/public/testemunhos", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async () => {
    return { testemunhos: await repo.publicos(db) };
  });
}
