import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "./pool.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

export async function migrate(db: Db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const files = readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    const done = await db.query<{ id: string }>("SELECT id FROM schema_migrations WHERE id = $1", [id]);
    if (done.rows[0]) continue;
    const sql = readFileSync(join(dir, file), "utf8");
    const parts = sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      await db.query(part.endsWith(";") ? part : `${part};`);
    }
    await db.query("INSERT INTO schema_migrations (id) VALUES ($1)", [id]);
  }
}
