/** Campanhas comerciais: lista com os números de cada campanha, ficha e edição. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  alterarCampanha, apagarCampanha, criarCampanha, listarCampanhas, obterCampanha, resumoCampanhas,
} from "../repos/campanhas.js";
import { idParam, textoQuery, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const dataOuVazio = z.string().trim().refine(v => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "data inválida (aaaa-mm-dd)");
const campanhaSchema = z.object({
  nome: z.string().trim().min(1, "indique o nome").max(120),
  data: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida (aaaa-mm-dd)"),
  encarregado: z.string().trim().max(80).optional().default(""),
  curso: z.string().trim().max(200).optional().default(""),
  custo: z.number().min(0).max(10_000_000).optional().default(0),
  fim: dataOuVazio.optional().default(""),
  canal: z.string().trim().max(80).optional().default(""),
  notas: z.string().max(2000).optional().default(""),
});
const campanhaPatch = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  data: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida (aaaa-mm-dd)").optional(),
  encarregado: z.string().trim().max(80).optional(),
  curso: z.string().trim().max(200).optional(),
  custo: z.number().min(0).max(10_000_000).optional(),
  fim: dataOuVazio.optional(),
  canal: z.string().trim().max(80).optional(),
  notas: z.string().max(2000).optional(),
}).refine(v => Object.keys(v).length > 0, "nada para alterar");

const filtrosQuery = z.object({
  estado: z.preprocess(v => (v === "" || v == null ? "todas" : v), z.enum(["ativas", "terminadas", "todas"])),
  canal: textoQuery(80),
  curso: textoQuery(200),
  responsavel: textoQuery(80),
  q: textoQuery(120),
});

function fimDepoisDoInicio(d: { data?: string; fim?: string }) {
  return !d.data || !d.fim || d.fim >= d.data;
}

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.get("/v1/campanhas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: filtrosQuery }, req);
    if (!v) return;
    const [campanhas, resumo] = await Promise.all([listarCampanhas(db, v.query), resumoCampanhas(db)]);
    return { campanhas, resumo };
  });

  app.get("/v1/campanhas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const campanha = await obterCampanha(db, v.params.id);
    if (!campanha) return reply.code(404).send({ error: "Campanha não encontrada." });
    return { campanha };
  });

  app.post("/v1/campanhas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: campanhaSchema }, req);
    if (!v) return;
    if (!fimDepoisDoInicio(v.body)) return reply.code(400).send({ error: "O fim tem de ser depois do início." });
    const id = await criarCampanha(db, v.body);
    await audit(db, req.actor!.id, "campanha.create", "campanha", String(id), req.ip);
    return { campanha: await obterCampanha(db, id) };
  });

  app.patch("/v1/campanhas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: campanhaPatch }, req);
    if (!v) return;
    const atual = await obterCampanha(db, v.params.id);
    if (!atual) return reply.code(404).send({ error: "Campanha não encontrada." });
    if (!fimDepoisDoInicio({ data: v.body.data ?? atual.data, fim: v.body.fim ?? atual.fim })) {
      return reply.code(400).send({ error: "O fim tem de ser depois do início." });
    }
    await alterarCampanha(db, v.params.id, v.body);
    await audit(db, req.actor!.id, "campanha.update", "campanha", String(v.params.id), req.ip, { campos: Object.keys(v.body) });
    return { campanha: await obterCampanha(db, v.params.id) };
  });

  app.delete("/v1/campanhas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const ok = await db.tx(q => apagarCampanha(q, v.params.id));
    if (!ok) return reply.code(404).send({ error: "Campanha não encontrada." });
    await audit(db, req.actor!.id, "campanha.delete", "campanha", String(v.params.id), req.ip);
    return { ok: true };
  });
}
