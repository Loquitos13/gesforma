/**
 * Páginas do site feitas no editor visual (blocos): rascunho, publicação e leitura pública.
 * Só a administração edita; o site público só vê a versão publicada.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ENDERECO_LIVRE, ENDERECOS_RESERVADOS, paginaLivre, paginaValida, validarPaginaSite } from "../../../src/partilhado/siteBlocos.js";
import { guardarImagemBlog } from "../cursoImagens.js";
import { pode } from "../permissoes/capacidades.js";
import * as repo from "../repos/sitePaginas.js";
import { validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const paginaParam = z.object({ pagina: z.string().max(80).refine(paginaValida, "página desconhecida") });
const novaLivre = z.object({ titulo: z.string().trim().min(2).max(120), endereco: z.string().trim().toLowerCase().max(60) });

/** Página livre nova: um título e um texto para começar (edita-se depois em blocos). */
function modeloLivre(titulo: string) {
  return {
    root: { props: {} },
    content: [{ type: "Seccao", props: { id: `Seccao-livre-${Date.now()}`, conteudo: [
      { type: "Titulo", props: { id: `Titulo-livre-${Date.now()}`, texto: titulo } },
      { type: "Texto", props: { id: `Texto-livre-${Date.now()}`, texto: "Escreva aqui o conteúdo da página." } },
    ] } }],
  };
}
const corpo = z.object({ dados: z.unknown() });
const LIMITE = 2 * 1024 * 1024;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : v ? String(v) : null);

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  const soAdmin = (role?: string) => Boolean(role && pode(role, "site.editar"));

  app.get("/v1/site/paginas/:pagina", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!soAdmin(req.actor?.role)) return reply.code(403).send({ error: "só o administrador edita o site" });
    const v = validar(reply, { params: paginaParam }, req);
    if (!v) return;
    const r = await repo.lerPagina(db, v.params.pagina);
    return {
      rascunho: r?.rascunho ?? null,
      publicado: r?.publicado ?? null,
      publicadoEm: iso(r?.publicado_em),
      atualizadoEm: iso(r?.atualizado_em),
    };
  });

  for (const acao of ["rascunho", "publicar"] as const) {
    app.put(`/v1/site/paginas/:pagina/${acao}`, { bodyLimit: LIMITE }, async (req, reply) => {
      if (!requireAuth(req, reply)) return;
      if (!soAdmin(req.actor?.role)) return reply.code(403).send({ error: "só o administrador edita o site" });
      const v = validar(reply, { params: paginaParam, body: corpo }, req);
      if (!v) return;
      const ok = validarPaginaSite(v.body.dados);
      if (!ok.ok) return reply.code(400).send({ error: ok.erro });
      if (acao === "publicar") {
        await repo.publicar(db, v.params.pagina, v.body.dados, req.actor!.id);
        await audit(db, req.actor!.id, "site.pagina.publicar", "site_paginas", v.params.pagina, req.ip);
      } else {
        await repo.gravarRascunho(db, v.params.pagina, v.body.dados, req.actor!.id);
      }
      return { ok: true };
    });
  }

  /** Páginas livres (endereço próprio, ex.: /sobre-nos). */
  app.get("/v1/site/paginas-livres", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!soAdmin(req.actor?.role)) return reply.code(403).send({ error: "só o administrador edita o site" });
    return { paginas: (await repo.listarLivres(db)).map(p => ({ pagina: p.pagina, endereco: p.pagina.slice("livre-".length), titulo: p.titulo, publicadoEm: iso(p.publicado_em) })) };
  });

  app.post("/v1/site/paginas-livres", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!soAdmin(req.actor?.role)) return reply.code(403).send({ error: "só o administrador edita o site" });
    const v = validar(reply, { body: novaLivre }, req);
    if (!v) return;
    const endereco = v.body.endereco.replace(/^\/+|\/+$/g, "");
    if (!ENDERECO_LIVRE.test(endereco)) return reply.code(400).send({ error: "Endereço: só letras minúsculas, números e hífenes (ex.: sobre-nos)." });
    if (ENDERECOS_RESERVADOS.has(endereco)) return reply.code(409).send({ error: `O endereço /${endereco} já é usado pelo site.` });
    const pagina = paginaLivre(endereco);
    if (!(await repo.criarLivre(db, pagina, v.body.titulo, modeloLivre(v.body.titulo), req.actor!.id))) {
      return reply.code(409).send({ error: `Já existe uma página em /${endereco}.` });
    }
    await audit(db, req.actor!.id, "site.pagina.criar", "site_paginas", pagina, req.ip);
    return { pagina, endereco };
  });

  app.delete("/v1/site/paginas-livres/:pagina", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!soAdmin(req.actor?.role)) return reply.code(403).send({ error: "só o administrador edita o site" });
    const v = validar(reply, { params: paginaParam }, req);
    if (!v) return;
    if (!v.params.pagina.startsWith("livre-")) return reply.code(400).send({ error: "Só as páginas livres se apagam." });
    await repo.apagarLivre(db, v.params.pagina);
    await audit(db, req.actor!.id, "site.pagina.apagar", "site_paginas", v.params.pagina, req.ip);
    return { ok: true };
  });

  app.post("/v1/site/imagem", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!soAdmin(req.actor?.role)) return reply.code(403).send({ error: "só o administrador edita o site" });
    let ficheiro: { nome: string; mime: string; bytes: Buffer } | null = null;
    try {
      for await (const part of req.parts()) {
        if (part.type === "file") ficheiro = { nome: part.filename || "imagem.jpg", mime: part.mimetype || "", bytes: await part.toBuffer() };
      }
    } catch {
      return reply.code(400).send({ error: "upload inválido (máximo 8 MB)" });
    }
    if (!ficheiro?.bytes.length) return reply.code(400).send({ error: "ficheiro em falta" });
    try {
      const gravada = await guardarImagemBlog(db, ficheiro);
      await audit(db, req.actor!.id, "site.imagem", "site", "", req.ip);
      return gravada;
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "upload recusado" });
    }
  });

  app.get("/v1/public/site/paginas/:pagina", async (req, reply) => {
    const v = validar(reply, { params: paginaParam }, req);
    if (!v) return;
    reply.header("cache-control", "no-store");
    const dados = await repo.lerPublicada(db, v.params.pagina);
    // Página livre: também o título (separador do browser).
    return v.params.pagina.startsWith("livre-") ? { dados, titulo: dados ? await repo.tituloDaLivre(db, v.params.pagina) : null } : { dados };
  });
}
