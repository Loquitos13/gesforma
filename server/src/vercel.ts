import type { IncomingMessage, ServerResponse } from "node:http";
import "./env.js";
import { assertSecureConfig } from "./config.js";
import { createDb } from "./db/pool.js";
import { migrate } from "./db/migrate.js";
import { seed } from "./db/seed.js";
import { buildApp } from "./app.js";
import type { FastifyInstance } from "fastify";

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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const app = await getApp();
  await app.ready();
  req.url = stripApiPrefix(req.url ?? "/");
  app.server.emit("request", req, res);
}
