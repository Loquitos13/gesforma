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
      assertSecureConfig();
      const db = await createDb();
      await migrate(db);
      await seed(db);
      return buildApp(db, { worker: false });
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
