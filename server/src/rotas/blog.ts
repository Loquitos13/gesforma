import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { LIMITE_CORPO_BLOG } from "../../../src/partilhado/blogBlocos.js";
import { excerto } from "../areaFormando.js";
import { guardarImagemBlog } from "../cursoImagens.js";
import * as repo from "../repos/blog.js";
import { idParam, textoQuery, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const slugValido = z.string().trim().min(1).max(200).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "use só minúsculas, números e hífens");

const postSchema = z.object({
  titulo: z.string().trim().min(1).max(200),
  slug: slugValido,
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida (aaaa-mm-dd)"),
  status: z.string().trim().min(1).max(20).optional().default("Ativo"),
  tematica: z.string().trim().max(120).optional().default(""),
  corpo: z.string().max(LIMITE_CORPO_BLOG).optional().default(""),
});

const listaQuery = z.object({ q: textoQuery(120), estado: textoQuery(20), tematica: textoQuery(120), ordem: textoQuery(20) });
const slugParam = z.object({ slug: z.string().max(200) });

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.get("/v1/blog", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: listaQuery }, req);
    if (!v) return;
    return { posts: await repo.listarPosts(db, v.query), resumo: await repo.resumoPosts(db) };
  });

  app.get("/v1/blog/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const post = await repo.obterPost(db, v.params.id);
    if (!post) return reply.code(404).send({ error: "publicação não encontrada" });
    return { post };
  });

  app.post("/v1/blog", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: postSchema }, req);
    if (!v) return;
    if (await repo.slugOcupado(db, v.body.slug, null)) return reply.code(409).send({ error: "Já existe uma publicação com esse endereço (slug)." });
    const id = await repo.criarPost(db, v.body);
    await audit(db, req.actor?.id, "blog.criar", "blog", String(id), req.ip, { slug: v.body.slug });
    return { post: await repo.obterPost(db, id) };
  });

  app.patch("/v1/blog/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: postSchema.partial() }, req);
    if (!v) return;
    if (!(await repo.obterPost(db, v.params.id))) return reply.code(404).send({ error: "publicação não encontrada" });
    if (v.body.slug && await repo.slugOcupado(db, v.body.slug, v.params.id)) {
      return reply.code(409).send({ error: "Já existe uma publicação com esse endereço (slug)." });
    }
    await repo.actualizarPost(db, v.params.id, v.body);
    await audit(db, req.actor?.id, "blog.editar", "blog", String(v.params.id), req.ip, { campos: Object.keys(v.body) });
    return { post: await repo.obterPost(db, v.params.id) };
  });

  app.delete("/v1/blog/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    await repo.apagarPost(db, v.params.id);
    await audit(db, req.actor?.id, "blog.apagar", "blog", String(v.params.id), req.ip);
    return { ok: true };
  });

  app.post("/v1/blog/imagem", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    let ficheiro: { nome: string; mime: string; bytes: Buffer } | null = null;
    try {
      for await (const part of req.parts()) {
        if (part.type === "file") ficheiro = { nome: part.filename || "imagem.jpg", mime: part.mimetype || "", bytes: await part.toBuffer() };
      }
    } catch {
      return reply.code(400).send({ error: "upload inválido" });
    }
    if (!ficheiro?.bytes.length) return reply.code(400).send({ error: "ficheiro em falta" });
    try {
      const gravada = await guardarImagemBlog(db, ficheiro);
      await audit(db, req.actor?.id, "blog.imagem", "blog", "", req.ip);
      return gravada;
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "upload recusado" });
    }
  });

  // ── Site público ──────────────────────────────────────────────────────────
  app.get("/v1/public/noticias", async (_req, reply) => {
    reply.header("cache-control", "no-store");
    const linhas = await repo.noticiasPublicas(db);
    return { noticias: linhas.map(r => ({ titulo: r.titulo, slug: r.slug, data: r.data, tematica: r.tematica, excerto: excerto(r.corpo) })) };
  });

  app.get("/v1/public/noticias/:slug", async (req, reply) => {
    reply.header("cache-control", "no-store");
    const r = slugParam.safeParse(req.params);
    if (!r.success) return reply.code(404).send({ error: "notícia não encontrada" });
    const post = await repo.noticiaPublica(db, r.data.slug);
    if (!post || post.status !== "Ativo") return reply.code(404).send({ error: "notícia não encontrada" });
    return { noticia: post, outras: await repo.outrasNoticias(db, r.data.slug) };
  });
}
