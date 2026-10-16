import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { erroPayloadCatalogo } from "../catalogoSchemas.js";
import { isCatalogKind } from "../db/catalogSeed.js";
import { podeAceder } from "../permissoes.js";
import { pode } from "../permissoes/capacidades.js";
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

const opcoesLoteQuery = opcoesQuery.extend({
  kinds: z.preprocess(
    v => (typeof v === "string" ? [...new Set(v.split(",").map(s => s.trim()).filter(Boolean))] : v),
    z.array(z.enum(KINDS_OPCOES)).min(1, "indique os tipos").max(20),
  ),
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

/** Gold e Financiada separadas: cada perfil só lê e escreve itens do regime em que trabalha. */
function veRegime(role: string, regime: string) {
  return pode(role, regime === "fin" ? "fin.ver" : "gold.ver");
}
const SEM_REGIME = { error: "Sem acesso aos registos deste regime." };

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

  /**
   * Várias listas num só pedido: `?kinds=cursos,turmas&regime=gold`. Cada tipo passa pela mesma regra de
   * acesso que `/v1/opcoes/:kind`; os que o perfil não pode ler não vêm na resposta.
   */
  app.get("/v1/opcoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: opcoesLoteQuery }, req);
    if (!v) return;
    const role = req.actor!.role;
    const permitidos = v.query.kinds.filter(k => podeAceder(role, "GET", `/v1/opcoes/${k}`));
    const opts = { regime: v.query.regime, lista: v.query.lista, todos: v.query.todos === "1" };
    const listas = await Promise.all(permitidos.map(k => listarOpcoes(db, k, opts)));
    return { opcoes: Object.fromEntries(permitidos.map((k, i) => [k, listas[i]!])) };
  });

  /** Itens de um catálogo com o número de registos que usam cada um. */
  app.get("/v1/catalogos/:kind", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: kindParam, query: regimeQuery }, req);
    if (!v) return;
    const role = req.actor!.role;
    if (v.query.regime && !veRegime(role, v.query.regime)) return reply.code(403).send(SEM_REGIME);
    const lista = (await itens.listarItens(db, v.params.kind, v.query.regime)).filter(i => veRegime(role, i.regime));
    return { kind: v.params.kind, itens: lista.map(i => ({ id: i.id, regime: i.regime, ...i.payload, uso: i.uso ?? {} })) };
  });

  app.post("/v1/catalog/:kind", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: kindParam, body: itemSchema }, req);
    if (!v) return;
    const { kind } = v.params;
    if (!veRegime(req.actor!.role, v.body.regime)) return reply.code(403).send(SEM_REGIME);
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
    if (!veRegime(req.actor!.role, antes.regime) || !veRegime(req.actor!.role, v.body.regime ?? antes.regime)) {
      return reply.code(403).send(SEM_REGIME);
    }
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
    const item = await itens.obterItem(db, kind, id);
    if (item && !veRegime(req.actor!.role, item.regime)) return reply.code(403).send(SEM_REGIME);
    const emUso = fraseUso(await itens.usoDoItem(db, kind, id));
    if (emUso && (COM_NOME.has(kind) || kind === "modulos")) {
      return reply.code(409).send({ error: `Está em uso (${emUso}). Mude esses registos ou desactive-o em vez de apagar.` });
    }
    await itens.apagarItem(db, kind, id);
    await audit(db, req.actor?.id, "catalogo.apagar", kind, String(id), req.ip);
    return { ok: true };
  });
}
