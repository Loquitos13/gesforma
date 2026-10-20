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

/** Contagem de consultas por pedido (aparece na linha de log do pedido: encontra N+1). */
export type Medicao = { n: number; ms: number };
const medicaoStore = new AsyncLocalStorage<Medicao>();

export function medirPedido(): Medicao {
  const m = { n: 0, ms: 0 };
  medicaoStore.enterWith(m);
  return m;
}

async function medido<R>(fn: () => Promise<R>, conta = 1): Promise<R> {
  const m = medicaoStore.getStore();
  if (!m) return fn();
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    m.n += conta;
    m.ms += performance.now() - t0;
  }
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

/**
 * Contexto da transacção numa só instrução: perfil e utilizador (RLS) e o fuso de Lisboa.
 * Com o fuso da sessão em Lisboa, current_date, now()::date, date_trunc e as conversões
 * date ↔ timestamptz contam dias de Lisboa mesmo onde o SQL não diz AT TIME ZONE (a Vercel e a
 * base correm em UTC). Os instantes não mudam; só o texto de um timestamptz (::text) passa a vir
 * com o desvio de Lisboa (+00/+01), que continua a ser um instante válido para new Date().
 */
const SET_ACTOR = "SELECT set_config('gesforma.api', '1', true), set_config('app.role', $1, true), set_config('app.user_id', $2, true), set_config('TimeZone', 'Europe/Lisbon', true)";

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
      // Avisos do servidor (ex.: "já existe, a saltar" nas migrações) não são erros: não poluir os logs.
      onnotice: () => undefined,
      types: {
        // Igual ao PGlite: um texto enviado para json/jsonb já é JSON (não se volta a codificar como string).
        json: {
          to: 114,
          from: [114, 3802],
          serialize: (x: unknown) => (typeof x === "string" ? x : JSON.stringify(x)),
          parse: (x: string) => JSON.parse(x),
        },
      },
    });
    return {
      driver: "postgres",
      async query<T extends Record<string, unknown>>(text: string, params: unknown[] = []) {
        const actor = actorAtual();
        // Perfil RLS e consulta enviados em pipeline: uma só ida e volta à base (BEGIN … COMMIT incluídos).
        const out = await medido(() => sql.begin((tx) => [
          tx.unsafe(SET_ACTOR, [actor.role || "system", actor.id || ""]),
          tx.unsafe(text, params as never[]),
        ]));
        const rows = (out as unknown as unknown[][])[1] ?? [];
        return { rows: [...rows] as unknown as T[] };
      },
      async tx<R>(fn: (q: TxQuery) => Promise<R>) {
        const actor = actorAtual();
        const out = await sql.begin(async (tx) => {
          await tx.unsafe(SET_ACTOR, [actor.role || "system", actor.id || ""]);
          const q: TxQuery = async <T extends Record<string, unknown>>(text: string, params: unknown[] = []) => {
            const rows = await medido(() => tx.unsafe(text, params as never[]));
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
      await client.query(SET_ACTOR, [actor.role || "system", actor.id || ""]);
      const q: TxQuery = async <T extends Record<string, unknown>>(text: string, params: unknown[] = []) => {
        const res = await medido(() => client.query<T>(text, mapParams(params)));
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
