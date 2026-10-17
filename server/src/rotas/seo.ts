import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { htmlDaPagina, indexHtml, robotsTxt, sitemapXml } from "../seo.js";
import type { Deps } from "./tipos.js";

// SEO: cada página do site servida com as suas etiquetas, sitemap.xml e robots.txt (reescritos em vercel.json).

// Cache na rede da Vercel: 10 min frescos e uma cópia antiga enquanto renova (o site não espera pela base de dados).
const CACHE = "public, max-age=0, s-maxage=600, stale-while-revalidate=86400";
const caminhoSchema = z.object({ caminho: z.string().max(400).default("/") });

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db } = deps;

  app.get("/v1/public/pagina", { config: { rateLimit: { max: 300, timeWindow: "1 minute" } } }, async (req, reply) => {
    const q = caminhoSchema.safeParse(req.query);
    const caminho = q.success ? q.data.caminho : "/";
    try {
      const r = await htmlDaPagina(db, caminho);
      if (r) return reply.code(r.estado).header("cache-control", CACHE).type("text/html; charset=utf-8").send(r.html);
    } catch (err) {
      req.log.error({ err, caminho }, "SEO: página servida sem etiquetas");
    }
    // Sem etiquetas, o site funciona na mesma (o React monta tudo no browser).
    const doc = await indexHtml();
    if (!doc) return reply.code(503).type("text/plain").send("Site indisponível. Tente daqui a pouco.");
    return reply.header("cache-control", "no-store").type("text/html; charset=utf-8").send(doc);
  });

  app.get("/v1/public/sitemap.xml", async (_req, reply) => {
    return reply.header("cache-control", CACHE).type("application/xml; charset=utf-8").send(await sitemapXml(db));
  });

  app.get("/v1/public/robots.txt", async (_req, reply) => {
    return reply.header("cache-control", CACHE).type("text/plain; charset=utf-8").send(await robotsTxt(db));
  });
}
