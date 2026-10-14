import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "./pool.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

/**
 * Aplica as migrações em falta. Uma só consulta para saber o que já está aplicado
 * (o arranque a frio em produção não verifica ficheiro a ficheiro) e cada migração
 * corre numa transacção: ou entra toda, ou nada.
 */
export async function migrate(db: Db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const feitas = new Set(
    (await db.query<{ id: string }>("SELECT id FROM schema_migrations")).rows.map(r => r.id),
  );
  const pendentes = readdirSync(dir).filter(f => f.endsWith(".sql")).sort()
    .filter(f => !feitas.has(f.replace(/\.sql$/, "")));
  for (const file of pendentes) {
    const id = file.replace(/\.sql$/, "");
    const sql = readFileSync(join(dir, file), "utf8");
    const parts = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    try {
      await db.tx(async q => {
        for (const part of parts) await q(part.endsWith(";") ? part : `${part};`);
        await q("INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING", [id]);
      });
    } catch (err) {
      throw new Error(`Migração ${id} falhou: ${(err as Error).message}`, { cause: err });
    }
  }
  return pendentes.length;
}
