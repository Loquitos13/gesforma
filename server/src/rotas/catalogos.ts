import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { erroPayloadCatalogo } from "../catalogoSchemas.js";
import { isCatalogKind } from "../db/catalogSeed.js";
import { KINDS_OPCOES, listarOpcoes } from "../repos/catalogos.js";
import * as itens from "../repos/catalogoItens.js";
import { idNum, regime, textoQuery, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const opcoesParams = z.object({ kind: z.enum(KINDS_OPCOES) });
const opcoesQuery = z.object({
  regime: regime.optional(),
  lista: textoQuery(40),
  todos: z.enum(["0", "1"]).optional(),
});

const kindParam = z.object({ kind: z.string().max(40).refine(isCatalogKind, "tipo de catálogo inválido") });
const kindIdParam = kindParam.extend({ id: idNum });
const regimeQuery = z.object({ regime: regime.optional() });

const itemSchema = z.object({
  regime: regime.optional().default("gold"),
  payload: z.record(z.unknown()),
});
const itemPatchSchema = z.object({
  regime: regime.optional(),
  payload: z.record(z.unknown()).optional(),
});

/** Tipos cujo nome é usado por outros registos: renomear propaga; apagar com uso é recusado. */
const COM_NOME = new Set(["locais", "horarios", "areas", "blog_tematicas"]);

const ROTULO_USO: Record<string, [string, string]> = {
  turmas: ["turma", "turmas"], datas: ["data", "datas"], cursos: ["curso", "cursos"], conteudos: ["conteúdo", "conteúdos"],
  posts: ["publicação", "publicações"], preinscricoes: ["pré-inscrição", "pré-inscrições"],
};

function fraseUso(uso: Record<string, number>) {
  const partes = Object.entries(uso).filter(([, n]) => n > 0).map(([k, n]) => {
    const [um, varios] = ROTULO_USO[k] ?? [k, k];
    return `${n} ${n === 1 ? um : varios}`;
  });
  return partes.length ? partes.join(", ") : "";
}

function tamanhoOk(payload: unknown) {
  return JSON.stringify(payload ?? {}).length <= 20_000;
}

// Catálogos (datas, locais, horários, áreas, módulos, conteúdos, temáticas, …) e opções para selects.
export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  /** Opções para selects e filtros, sempre da base de dados. */
  app.get("/v1/opcoes/:kind", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: opcoesParams, query: opcoesQuery }, req);
    if (!v) return;
    const opcoes = await listarOpcoes(db, v.params.kind, {
      regime: v.query.regime,
      lista: v.query.lista,
      todos: v.query.todos === "1",
    });
    return { kind: v.params.kind, opcoes };
  });

  /** Itens de um catálogo com o número de registos que usam cada um. */
  app.get("/v1/catalogos/:kind", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: kindParam, query: regimeQuery }, req);
    if (!v) return;
    const lista = await itens.listarItens(db, v.params.kind, v.query.regime);
    return { kind: v.params.kind, itens: lista.map(i => ({ id: i.id, regime: i.regime, ...i.payload, uso: i.uso ?? {} })) };
  });

  app.post("/v1/catalog/:kind", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: kindParam, body: itemSchema }, req);
    if (!v) return;
    const { kind } = v.params;
    if (!tamanhoOk(v.body.payload)) return reply.code(400).send({ error: "payload demasiado grande" });
    const erroPayload = erroPayloadCatalogo(kind, v.body.payload);
    if (erroPayload) return reply.code(400).send({ error: erroPayload });
    const id = await itens.proximoIdCatalogo(db);
    await itens.criarItem(db, id, kind, v.body.regime, v.body.payload);
    await audit(db, req.actor?.id, "catalogo.criar", kind, String(id), req.ip, { regime: v.body.regime });
    if (kind === "inscricoes_fin") {
      const { upsertFormandoFinFromInscricao } = await import("../finPipeline.js");
      const aviso = await upsertFormandoFinFromInscricao(db, v.body.payload)
        .then(() => null).catch(err => (err instanceof Error ? err.message : "Ficha do formando não criada."));
      return { item: { id, ...v.body.payload }, aviso };
    }
    return { item: { id, ...v.body.payload } };
  });

  app.patch("/v1/catalog/:kind/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: kindIdParam, body: itemPatchSchema }, req);
    if (!v) return;
    const { kind, id } = v.params;
    if (v.body.payload && !tamanhoOk(v.body.payload)) return reply.code(400).send({ error: "payload demasiado grande" });
    if (v.body.payload) {
      const erroPayload = erroPayloadCatalogo(kind, v.body.payload);
      if (erroPayload) return reply.code(400).send({ error: erroPayload });
    }
    const antes = await itens.obterItem(db, kind, id);
    if (!antes) return reply.code(404).send({ error: "registo não encontrado" });
    await itens.actualizarItem(db, kind, id, v.body.payload ?? null, v.body.regime ?? null);
    const depois = await itens.obterItem(db, kind, id);
    const payload = depois?.payload ?? {};
    if (COM_NOME.has(kind)) {
      await itens.propagarNome(db, kind, antes.regime, String(antes.payload.nome ?? ""), String(payload.nome ?? ""));
    }
    if (kind === "modulos") {
      await itens.propagarCodigoModulo(db, antes.regime, String(antes.payload.curso ?? ""), String(antes.payload.codigo ?? ""), String(payload.codigo ?? ""));
    }
    await audit(db, req.actor?.id, "catalogo.editar", kind, String(id), req.ip, { regime: depois?.regime });
    if (kind === "inscricoes_fin") {
      const { upsertFormandoFinFromInscricao } = await import("../finPipeline.js");
      const aviso = await upsertFormandoFinFromInscricao(db, payload)
        .then(() => null).catch(err => (err instanceof Error ? err.message : "Ficha do formando não actualizada."));
      return { item: { id, ...payload }, aviso };
    }
    return { item: { id, ...payload } };
  });

  app.delete("/v1/catalog/:kind/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: kindIdParam }, req);
    if (!v) return;
    const { kind, id } = v.params;
    const emUso = fraseUso(await itens.usoDoItem(db, kind, id));
    if (emUso && (COM_NOME.has(kind) || kind === "modulos")) {
      return reply.code(409).send({ error: `Está em uso (${emUso}). Mude esses registos ou desactive-o em vez de apagar.` });
    }
    await itens.apagarItem(db, kind, id);
    await audit(db, req.actor?.id, "catalogo.apagar", kind, String(id), req.ip);
    return { ok: true };
  });
}
