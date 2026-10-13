import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import { config } from "../config.js";

export type QueryResult<T> = { rows: T[] };

export type DbActor = { id: string; role: string };

const actorStore = new AsyncLocalStorage<DbActor>();

/** Define o perfil da linha para o resto deste pedido. Sem perfil, a consulta corre como sistema. */
export function enterActor(actor: DbActor | null) {
  actorStore.enterWith(actor && actor.role ? actor : { id: "", role: "system" });
}

function actorAtual(): DbActor {
  return actorStore.getStore() ?? { id: "", role: "system" };
}

export type TxQuery = <T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<QueryResult<T>>;

export interface Db {
  driver: "postgres" | "pglite";
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  /**
   * Corre várias consultas numa só transacção, com o mesmo perfil RLS.
   * Dentro de `fn` usa-se só o `q` recebido — chamar `db.query` bloqueia em PGlite.
   */
  tx<R>(fn: (q: TxQuery) => Promise<R>): Promise<R>;
  close(): Promise<void>;
}

export async function createDb(): Promise<Db> {
  if (config.databaseUrl) {
    const neon = /neon\.tech|sslmode=require/.test(config.databaseUrl);
    const sql = postgres(config.databaseUrl, {
      max: process.env.VERCEL ? 1 : 12,
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: !process.env.VERCEL,
      ssl: process.env.DATABASE_SSL === "require" || neon ? "require" : false,
      connection: { application_name: "gesforma-api" },
    });
    return {
      driver: "postgres",
      async query<T extends Record<string, unknown>>(text: string, params: unknown[] = []) {
        const actor = actorAtual();
        const rows = await sql.begin(async (tx) => {
          await tx.unsafe("SELECT set_config('gesforma.api', '1', true)");
          await tx.unsafe("SELECT set_config('app.role', $1, true)", [actor.role || "system"]);
          await tx.unsafe("SELECT set_config('app.user_id', $1, true)", [actor.id || ""]);
          return tx.unsafe(text, params as never[]);
        });
        return { rows: [...rows] as unknown as T[] };
      },
      async tx<R>(fn: (q: TxQuery) => Promise<R>) {
        const actor = actorAtual();
        const out = await sql.begin(async (tx) => {
          await tx.unsafe("SELECT set_config('gesforma.api', '1', true)");
          await tx.unsafe("SELECT set_config('app.role', $1, true)", [actor.role || "system"]);
          await tx.unsafe("SELECT set_config('app.user_id', $1, true)", [actor.id || ""]);
          const q: TxQuery = async <T extends Record<string, unknown>>(text: string, params: unknown[] = []) => {
            const rows = await tx.unsafe(text, params as never[]);
            return { rows: [...rows] as unknown as T[] };
          };
          return { v: await fn(q) };
        });
        return (out as { v: R }).v;
      },
      async close() {
        await sql.end({ timeout: 5 });
      },
    };
  }

  mkdirSync(dirname(config.pgliteDir), { recursive: true });
  const client = new PGlite(config.pgliteDir);
  await client.waitReady;
  let tail: Promise<unknown> = Promise.resolve();

  function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = tail.then(fn, fn);
    tail = run.then(() => undefined, () => undefined);
    return run;
  }

  const mapParams = (params: unknown[]) => params.map(p => (
    p !== null && typeof p === "object" && !(p instanceof Date) && !(p instanceof Uint8Array) ? JSON.stringify(p) : p
  ));

  async function emTransaccao<R>(actor: DbActor, fn: (q: TxQuery) => Promise<R>): Promise<R> {
    try {
      await client.exec("BEGIN");
      await client.query("SELECT set_config('gesforma.api', '1', true)");
      await client.query("SELECT set_config('app.role', $1, true)", [actor.role || "system"]);
      await client.query("SELECT set_config('app.user_id', $1, true)", [actor.id || ""]);
      const q: TxQuery = async <T extends Record<string, unknown>>(text: string, params: unknown[] = []) => {
        const res = await client.query<T>(text, mapParams(params));
        return { rows: res.rows };
      };
      const out = await fn(q);
      await client.exec("COMMIT");
      return out;
    } catch (err) {
      await client.exec("ROLLBACK").catch(() => undefined);
      throw err;
    }
  }

  return {
    driver: "pglite",
    async query<T extends Record<string, unknown>>(text: string, params: unknown[] = []) {
      const actor = actorAtual();
      return exclusive(() => emTransaccao(actor, q => q<T>(text, params)));
    },
    async tx<R>(fn: (q: TxQuery) => Promise<R>) {
      const actor = actorAtual();
      return exclusive(() => emTransaccao(actor, fn));
    },
    async close() {
      await client.close();
    },
  };
}
