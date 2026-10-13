import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";

export type Perfil = "admin" | "secretaria" | "comercial" | "financiada" | "formador" | "formando";

export type Ctx = {
  app: FastifyInstance;
  db: import("../src/db/pool.js").Db;
  cookie: Record<Perfil, string>;
  userId: Record<Perfil, string>;
};

let partilhado: Promise<Ctx> | null = null;

/** Uma API real sobre PGlite temporário, com uma sessão por perfil. Partilhada pelo ficheiro de testes. */
export function arrancar(): Promise<Ctx> {
  partilhado ??= (async () => {
    process.env.PGLITE_DIR = mkdtempSync(join(tmpdir(), "gesforma-test-"));
    process.env.MAIL_MODE = "log";
    const { config } = await import("../src/config.js");
    const { createDb } = await import("../src/db/pool.js");
    const { migrate } = await import("../src/db/migrate.js");
    const { seed } = await import("../src/db/seed.js");
    const { buildApp } = await import("../src/app.js");
    const db = await createDb();
    await migrate(db);
    await seed(db);
    const app = await buildApp(db);
    await app.ready();
    const perfis: Perfil[] = ["admin", "secretaria", "comercial", "financiada", "formador", "formando"];
    const cookie = {} as Record<Perfil, string>;
    const userId = {} as Record<Perfil, string>;
    for (const role of perfis) {
      const id = randomUUID();
      await db.query(
        "INSERT INTO users (id, name, email, password_hash, role, active) VALUES ($1, $2, $3, 'x', $4, true)",
        [id, `Teste ${role}`, `teste.${role}@exemplo.pt`, role],
      );
      const token = randomBytes(24).toString("hex");
      await db.query(
        "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '1 day')",
        [randomUUID(), id, createHash("sha256").update(token).digest("hex")],
      );
      cookie[role] = `${config.cookieName}=${token}`;
      userId[role] = id;
    }
    return { app, db, cookie, userId };
  })();
  return partilhado;
}

export async function pedido(
  ctx: Ctx,
  perfil: Perfil | null,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  url: string,
  payload?: unknown,
) {
  const headers: Record<string, string> = { "x-gesforma-client": "web" };
  if (perfil) headers.cookie = ctx.cookie[perfil];
  return ctx.app.inject({ method, url, headers, payload: payload as never });
}
