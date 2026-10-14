// Corre antes de cada ficheiro de testes, antes de qualquer import de `src/`.
// `config.ts` lê PGLITE_DIR e DATABASE_URL uma só vez: se um teste importar um módulo de `src/` no topo,
// sem isto a configuração ficava com a base de desenvolvimento (server/data/pglite).
// Com TEST_DATABASE_URL (npm run test:pg), cada ficheiro corre numa base Postgres nova, com RLS a valer.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import postgres from "postgres";

const dir = mkdtempSync(join(tmpdir(), "gesforma-test-"));
process.env.PGLITE_DIR = dir;
process.env.MAIL_MODE = "log";
process.once("exit", () => {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ainda aberto: fica para o sistema */ }
});

const base = process.env.TEST_DATABASE_URL;
if (base) {
  const nome = `gesforma_t_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  const admin = postgres(base, { max: 1, onnotice: () => undefined });
  await admin.unsafe(`CREATE DATABASE ${nome}`);
  await admin.end();
  const url = new URL(base);
  url.pathname = `/${nome}`;
  process.env.DATABASE_URL = url.toString();
} else {
  delete process.env.DATABASE_URL;
}
