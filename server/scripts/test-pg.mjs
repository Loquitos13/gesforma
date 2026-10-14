// Corre a suite contra Postgres real, com um papel sem superutilizador (RLS a valer, como em produção).
// Arranca (ou reutiliza) o contentor Docker `gesforma-pg-teste` quando TEST_DATABASE_URL não está definida.
import { execFileSync, spawnSync } from "node:child_process";

const CONTENTOR = "gesforma-pg-teste";
const PORTA = 55432;

function docker(args, opts = {}) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
}

function garantirContentor() {
  const existe = spawnSync("docker", ["inspect", "-f", "{{.State.Running}}", CONTENTOR], { encoding: "utf8" });
  if (existe.status !== 0) {
    docker(["run", "-d", "--name", CONTENTOR, "-e", "POSTGRES_PASSWORD=superteste", "-p", `${PORTA}:5432`, "postgres:16"]);
  } else if (existe.stdout.trim() !== "true") {
    docker(["start", CONTENTOR]);
  }
  for (let i = 0; i < 60; i++) {
    if (spawnSync("docker", ["exec", CONTENTOR, "pg_isready", "-U", "postgres"]).status === 0) break;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  // Papel dono das bases, sem superutilizador nem BYPASSRLS: igual ao dono da base em produção.
  spawnSync("docker", ["exec", CONTENTOR, "psql", "-U", "postgres", "-c",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'gesforma_app') THEN " +
    "CREATE ROLE gesforma_app LOGIN PASSWORD 'appteste' CREATEDB NOSUPERUSER NOBYPASSRLS; END IF; END $$;"]);
}

if (!process.env.TEST_DATABASE_URL) {
  garantirContentor();
  process.env.TEST_DATABASE_URL = `postgres://gesforma_app:appteste@127.0.0.1:${PORTA}/postgres`;
}

const r = spawnSync("npx", ["vitest", "run", ...process.argv.slice(2)], { stdio: "inherit", shell: true, env: process.env });
process.exit(r.status ?? 1);
