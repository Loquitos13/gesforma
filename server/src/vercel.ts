import type { IncomingMessage, ServerResponse } from "node:http";
import "./env.js";
import { assertSecureConfig } from "./config.js";
import { createDb } from "./db/pool.js";
import { migrate } from "./db/migrate.js";
import { seed } from "./db/seed.js";
import { buildApp } from "./app.js";
import type { FastifyInstance } from "fastify";
import { indexHtml } from "./seo.js";

let boot: Promise<FastifyInstance> | undefined;

async function getApp() {
  if (!boot) {
    boot = (async () => {
      try {
        const t0 = performance.now();
        assertSecureConfig();
        const db = await createDb();
        const aplicadas = await migrate(db);
        const t1 = performance.now();
        try {
          await seed(db);
        } catch (err) {
          console.error("seed falhou; a API continua a servir", err);
        }
        const app = await buildApp(db, { worker: false });
        // Custo do arranque a frio (aparece uma vez por instância nos logs da Vercel).
        console.log(JSON.stringify({
          arranque: true,
          migracoes: aplicadas,
          migrarMs: Math.round(t1 - t0),
          totalMs: Math.round(performance.now() - t0),
          regiao: process.env.VERCEL_REGION ?? null,
        }));
        return app;
      } catch (err) {
        boot = undefined;
        throw err;
      }
    })();
  }
  return boot;
}

function stripApiPrefix(url: string) {
  if (url === "/api") return "/";
  if (url.startsWith("/api?")) return `/${url.slice(4)}`;
  if (url.startsWith("/api/")) return url.slice(4);
  return url;
}

/**
 * As páginas do site, o sitemap.xml e o robots.txt também chegam aqui (vercel.json): o URL original é o da página
 * (ou, se a Vercel passar o destino, «/api?__pagina=/caminho»). Passam às rotas de SEO.
 */
export function rotaInterna(url: string) {
  const destino = url.match(/^\/api\?__pagina=([^&]*)/);
  const pagina = destino ? decodeURIComponent(destino[1]!) : url.startsWith("/api") ? null : url;
  if (pagina == null) return { url: stripApiPrefix(url), pagina: false };
  const caminho = pagina.split("?")[0] || "/";
  if (caminho === "/sitemap.xml") return { url: "/v1/public/sitemap.xml", pagina: true };
  if (caminho === "/robots.txt") return { url: "/v1/public/robots.txt", pagina: true };
  return { url: `/v1/public/pagina?caminho=${encodeURIComponent(caminho)}`, pagina: true };
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const r = rotaInterna(req.url ?? "/");
  let app: FastifyInstance;
  try {
    app = await getApp();
    await app.ready();
  } catch (err) {
    // Sem servidor (base de dados em baixo): as páginas do site abrem na mesma, só sem as etiquetas de SEO.
    const doc = r.pagina && !r.url.includes(".xml") && !r.url.includes(".txt") ? await indexHtml().catch(() => null) : null;
    if (!doc) throw err;
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(doc);
    return;
  }
  req.url = r.url;
  app.server.emit("request", req, res);
}
