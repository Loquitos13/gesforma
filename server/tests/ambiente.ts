// Corre antes de cada ficheiro de testes, antes de qualquer import de `src/`.
// `config.ts` lê PGLITE_DIR uma só vez: se um teste importar um módulo de `src/` no topo,
// sem isto a configuração ficava com a base de desenvolvimento (server/data/pglite).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "gesforma-test-"));
process.env.PGLITE_DIR = dir;
process.env.MAIL_MODE = "log";
process.once("exit", () => {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* ainda aberto: fica para o sistema */ }
});
