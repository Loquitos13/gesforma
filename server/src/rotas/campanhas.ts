/** Campanhas comerciais: lista com os números de cada campanha, ficha e edição. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  alterarCampanha, apagarCampanha, criarCampanha, listarCampanhas, obterCampanha, resumoCampanhas,
} from "../repos/campanhas.js";
import { CampanhaErro, candidatosCampanha, enviarCampanha } from "../campanhasEmail.js";
import { destinosDoEnvio, listarEnvios } from "../repos/campanhasEmail.js";
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

/** Quem recebe a campanha por email: há quantos dias se pré-inscreveu, contactos já feitos, curso. */
const criteriosSchema = z.object({
  dias: z.coerce.number().int().min(0).max(3650).default(30),
  contactos: z.coerce.number().int().min(0).max(50).default(2),
  curso: z.string().trim().max(200).optional().default(""),
  soDocsEmFalta: z.preprocess(v => v === true || v === "1" || v === "true", z.boolean()).optional().default(false),
});
const envioSchema = z.object({
  criterios: criteriosSchema,
  ids: z.array(z.number().int().positive()).min(1, "escolha pelo menos uma pré-inscrição").max(150, "no máximo 150 por envio"),
  campanhaId: z.number().int().positive().nullable().optional().default(null),
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

  app.get("/v1/campanhas/email/candidatos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: criteriosSchema }, req);
    if (!v) return;
    return { candidatos: await candidatosCampanha(db, v.query) };
  });

  app.get("/v1/campanhas/email/envios", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const envios = await listarEnvios(db);
    return {
      envios: envios.map(e => ({
        id: Number(e.id), campanhaId: e.campanha_id == null ? null : Number(e.campanha_id), campanha: e.campanha ?? "",
        criterios: e.criterios, total: Number(e.total), enviados: Number(e.enviados), criadoEm: e.criado_em, autor: e.autor ?? "",
      })),
    };
  });

  app.get("/v1/campanhas/email/envios/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const destinos = await destinosDoEnvio(db, v.params.id);
    return {
      destinos: destinos.map(d => ({
        preinscricaoId: Number(d.preinscricao_id), nome: `${d.nome} ${d.apelido}`.trim(), curso: d.curso, estado: d.estado, enviado: d.enviado, erro: d.erro,
      })),
    };
  });

  app.post("/v1/campanhas/email/enviar", { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: envioSchema }, req);
    if (!v) return;
    try {
      const r = await enviarCampanha(db, req.actor!.id, v.body);
      await audit(db, req.actor!.id, "campanha.email_enviar", "campanha_envio", String(r.envioId), req.ip, { total: r.total, postos: r.postos });
      return r;
    } catch (err) {
      if (err instanceof CampanhaErro) return reply.code(409).send({ error: err.message });
      throw err;
    }
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
