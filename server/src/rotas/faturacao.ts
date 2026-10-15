/** Dados de faturação: página pública da ligação pessoal e botão «Contabilidade» da ficha do CRM. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { dadosFaturacaoSchema, faturacaoParaEquipa, faturacaoPublica, gravarFaturacaoPublica, pedirFaturacao } from "../faturacao.js";
import { idParam, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const tokenParam = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{20,60}$/, "ligação inválida") });

/** Só a secretaria e a administração vêem e pedem os dados de faturação. */
function podeContabilidade(role: string | undefined) {
  return role === "admin" || role === "secretaria";
}

export async function registarFaturacao(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.get("/v1/public/faturacao/:token", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    const v = validar(reply, { params: tokenParam }, req);
    if (!v) return;
    const out = await faturacaoPublica(db, v.params.token);
    if (!out) return reply.code(404).send({ error: "Ligação inválida ou expirada." });
    return out;
  });

  app.post("/v1/public/faturacao/:token", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (req, reply) => {
    const v = validar(reply, { params: tokenParam, body: dadosFaturacaoSchema }, req);
    if (!v) return;
    if (!(await gravarFaturacaoPublica(db, v.params.token, v.body))) return reply.code(404).send({ error: "Ligação inválida ou expirada." });
    return { ok: true };
  });

  app.get("/v1/crm/leads/:id/faturacao", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!podeContabilidade(req.actor?.role)) return reply.code(403).send({ error: "Só a secretaria ou a administração vê os dados de faturação." });
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const out = await faturacaoParaEquipa(db, v.params.id);
    if (out.dados) await audit(db, req.actor!.id, "faturacao.ver", "preinscricao", String(v.params.id), req.ip, {});
    return out;
  });

  app.post("/v1/crm/leads/:id/faturacao/pedir", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!podeContabilidade(req.actor?.role)) return reply.code(403).send({ error: "Só a secretaria ou a administração pede os dados de faturação." });
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const r = await pedirFaturacao(db, v.params.id, req.actor!.id);
    if (!r.enviado) return reply.code(409).send({ error: r.erro });
    await audit(db, req.actor!.id, "faturacao.pedir", "preinscricao", String(v.params.id), req.ip, {});
    return faturacaoParaEquipa(db, v.params.id);
  });
}
