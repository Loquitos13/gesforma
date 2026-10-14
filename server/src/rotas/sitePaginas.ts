/**
 * Páginas do site feitas no editor visual (blocos): rascunho, publicação e leitura pública.
 * Só a administração edita; o site público só vê a versão publicada.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PAGINAS_SITE, validarPaginaSite } from "../../../src/partilhado/siteBlocos.js";
import { guardarImagemBlog } from "../cursoImagens.js";
import { pode } from "../permissoes/capacidades.js";
import * as repo from "../repos/sitePaginas.js";
import { validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const paginaParam = z.object({ pagina: z.enum(PAGINAS_SITE) });
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
    return { dados: await repo.lerPublicada(db, v.params.pagina) };
  });
}
