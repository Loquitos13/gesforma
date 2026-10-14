import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { listarAuditoria, opcoesAuditoria } from "../repos/auditoria.js";
import { paginacao, periodoQuery, textoQuery, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

// Registo de auditoria (só administração: regra em permissoes/auditoria.ts e verificação aqui).

const listaQuery = paginacao.merge(periodoQuery).extend({
  entidade: textoQuery(60),
  accao: textoQuery(60),
  entidadeId: textoQuery(80),
  utilizador: z.preprocess(v => (v === "" ? undefined : v), z.string().uuid().optional()),
});

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth } = deps;

  app.get("/v1/auditoria", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor!.role !== "admin") return reply.code(403).send({ error: "só a administração consulta a auditoria" });
    const v = validar(reply, { query: listaQuery }, req);
    if (!v) return;
    return listarAuditoria(db, v.query);
  });

  app.get("/v1/auditoria/opcoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor!.role !== "admin") return reply.code(403).send({ error: "só a administração consulta a auditoria" });
    return opcoesAuditoria(db);
  });
}
