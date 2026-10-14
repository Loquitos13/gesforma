import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as repo from "../repos/listas.js";
import { idNum, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const listaParam = z.object({ lista: z.string().max(40).refine(repo.listaValida, "lista desconhecida") });
const opcaoParam = listaParam.extend({ id: idNum });
const nomeBody = z.object({ nome: z.string().trim().min(1, "Escreva o nome.").max(120) });
const publicaQuery = z.object({ lista: z.string().max(80).optional() });

// Listas de opções: leitura com uso por opção, criação, renomear (propaga) e apagar.
export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.get("/v1/listas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return { listas: await repo.resumoListas(db) };
  });

  app.get("/v1/listas/:lista", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: listaParam }, req);
    if (!v) return;
    const def = repo.LISTAS[v.params.lista]!;
    return { lista: v.params.lista, titulo: def.titulo, descricao: def.descricao, opcoes: await repo.opcoesDaLista(db, v.params.lista) };
  });

  app.post("/v1/listas/:lista", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: listaParam, body: nomeBody }, req);
    if (!v) return;
    if (await repo.existeNome(db, v.params.lista, v.body.nome)) return reply.code(409).send({ error: "Essa opção já existe." });
    const id = await repo.criarOpcao(db, v.params.lista, v.body.nome);
    await audit(db, req.actor?.id, "lista.criar", "lista_opcoes", String(id), req.ip, { lista: v.params.lista, nome: v.body.nome });
    return { opcao: { id, nome: v.body.nome, uso: 0, usoPor: {} } };
  });

  /** Renomeia a opção e todos os registos que a usam, numa transacção. */
  app.post("/v1/listas/:lista/:id/renomear", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: opcaoParam, body: nomeBody }, req);
    if (!v) return;
    const { lista, id } = v.params;
    const atual = await repo.obterOpcao(db, lista, id);
    if (!atual) return reply.code(404).send({ error: "opção não encontrada" });
    if (atual.nome === v.body.nome) return { ok: true, registos: 0 };
    if (await repo.existeNome(db, lista, v.body.nome, id)) return reply.code(409).send({ error: "Já existe uma opção com esse nome." });
    const registos = await db.tx(q => repo.renomearOpcao(q, lista, id, atual.nome, v.body.nome));
    await audit(db, req.actor?.id, "lista.renomear", "lista_opcoes", String(id), req.ip, { lista, de: atual.nome, para: v.body.nome, registos });
    return { ok: true, registos };
  });

  app.delete("/v1/listas/:lista/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: opcaoParam }, req);
    if (!v) return;
    const atual = await repo.obterOpcao(db, v.params.lista, v.params.id);
    if (!atual) return reply.code(404).send({ error: "opção não encontrada" });
    await repo.apagarOpcao(db, v.params.lista, v.params.id);
    await audit(db, req.actor?.id, "lista.apagar", "lista_opcoes", String(v.params.id), req.ip, { lista: v.params.lista, nome: atual.nome });
    return { ok: true };
  });

  /** Valores públicos de uma lista (formulário do site). */
  app.get("/v1/public/opcoes", async req => {
    const r = publicaQuery.safeParse(req.query);
    const lista = (r.success ? r.data.lista ?? "" : "").trim();
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(lista)) return { lista: "", opcoes: [] as string[] };
    return { lista, opcoes: await repo.nomesPublicos(db, lista) };
  });
}
