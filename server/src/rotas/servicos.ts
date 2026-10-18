import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { slugServico, videoServico } from "../../../src/partilhado/siteServicos.js";
import * as repo from "../repos/servicos.js";
import { idNum, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

// Serviços para empresas: a administração escreve-os em Gestão › Empresas / Business (matriz: só admin, em permissoes/site.ts);
// o site mostra os ativos nos cartões da página Empresas e cada um na sua página (/empresas/<slug>).

const texto = (max: number) => z.string().trim().max(max).default("");
// Imagens do próprio site (carregadas pelo backoffice) ou https.
const imagem = z.string().trim().max(500).refine(v => v === "" || /^\/(api\/v1\/public\/imagens|imagens)\//.test(v) || /^https:\/\//i.test(v), "imagem inválida").default("");

const dadosSchema = z.object({
  titulo: z.string().trim().min(2, "Escreva o título.").max(120),
  etiqueta: texto(40),
  texto: texto(1200),
  pontos: texto(1200),
  detalhe: texto(12000),
  rotulo: texto(40),
  ligacao: texto(300),
  imagem,
  imagens: z.array(z.object({ imagem, legenda: texto(200) })).max(30).default([]),
  video: texto(500).refine(v => v === "" || videoServico(v) != null, "Vídeo inválido: use um endereço do YouTube, do Vimeo ou de um ficheiro .mp4 (https)."),
  logos: z.array(z.object({ imagem, alt: texto(120), ligacao: texto(300) })).max(60).default([]),
});
const servicoSchema = z.object({
  slug: texto(80),
  ordem: z.number().int().min(0).max(100000).optional(),
  ativo: z.boolean().default(true),
  dados: dadosSchema,
});

const ehDuplicado = (e: unknown) => (e as { code?: string })?.code === "23505";

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  const preparar = async (b: z.infer<typeof servicoSchema>) => ({
    slug: slugServico({ slug: b.slug, titulo: b.dados.titulo }),
    ordem: b.ordem ?? await repo.proximaOrdem(db),
    ativo: b.ativo,
    dados: b.dados,
  });

  app.get("/v1/servicos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return { servicos: await repo.listar(db) };
  });

  app.post("/v1/servicos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: servicoSchema }, req);
    if (!v) return;
    const s = await preparar(v.body);
    if (!s.slug) return reply.code(400).send({ error: "O endereço da página ficou vazio: use letras ou números no título." });
    try {
      const r = await repo.criar(db, s);
      await audit(db, req.actor!.id, "servico.criar", "servico", String(r?.id ?? ""), req.ip);
      return { servico: r };
    } catch (e) {
      if (ehDuplicado(e)) return reply.code(409).send({ error: `Já existe um serviço com o endereço «${s.slug}».` });
      throw e;
    }
  });

  app.put("/v1/servicos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: z.object({ id: idNum }), body: servicoSchema }, req);
    if (!v) return;
    const s = await preparar(v.body);
    if (!s.slug) return reply.code(400).send({ error: "O endereço da página ficou vazio: use letras ou números no título." });
    try {
      const r = await repo.atualizar(db, v.params.id, s);
      if (!r) return reply.code(404).send({ error: "serviço inexistente" });
      await audit(db, req.actor!.id, "servico.gravar", "servico", String(v.params.id), req.ip);
      return { servico: r };
    } catch (e) {
      if (ehDuplicado(e)) return reply.code(409).send({ error: `Já existe um serviço com o endereço «${s.slug}».` });
      throw e;
    }
  });

  app.delete("/v1/servicos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: z.object({ id: idNum }) }, req);
    if (!v) return;
    if (!(await repo.apagar(db, v.params.id))) return reply.code(404).send({ error: "serviço inexistente" });
    await audit(db, req.actor!.id, "servico.apagar", "servico", String(v.params.id), req.ip);
    return { ok: true };
  });

  app.get("/v1/public/servicos", { config: { rateLimit: { max: 120, timeWindow: "1 minute" } } }, async (_req, reply) => {
    reply.header("cache-control", "no-store");
    return { servicos: (await repo.ativos(db)).map(s => ({ ...s.dados, slug: s.slug })) };
  });
}
