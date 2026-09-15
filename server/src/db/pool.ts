import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import postgres from "postgres";
import { PGlite } from "@electric-sql/pglite";
import { config } from "../config.js";

export type QueryResult<T> = { rows: T[] };

export interface Db {
  driver: "postgres" | "pglite";
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  close(): Promise<void>;
}

export async function createDb(): Promise<Db> {
  if (config.databaseUrl) {
    const sql = postgres(config.databaseUrl, {
      max: 12,
      idle_timeout: 20,
      connect_timeout: 15,
      prepare: true,
      ssl: process.env.DATABASE_SSL === "require" ? "require" : false,
      connection: { application_name: "gesforma-api" },
    });
    return {
      driver: "postgres",
      async query<T extends Record<string, unknown>>(text: string, params: unknown[] = []) {
        const rows = await sql.unsafe(text, params as never[]);
        return { rows: [...rows] as unknown as T[] };
      },
      async close() {
        await sql.end({ timeout: 5 });
      },
    };
  }

  mkdirSync(dirname(config.pgliteDir), { recursive: true });
  const client = new PGlite(config.pgliteDir);
  await client.waitReady;
  return {
    driver: "pglite",
    async query<T extends Record<string, unknown>>(text: string, params: unknown[] = []) {
      const res = await client.query<T>(text, params);
      return { rows: res.rows };
    },
    async close() {
      await client.close();
    },
  };
}
