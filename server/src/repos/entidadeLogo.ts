/** Logótipo da entidade: um só registo, bytes na base de dados. */
import { many, one, type Consulta } from "./sql.js";

export type LogoLinha = { nome: string; mime: string; bytes: unknown; hash: string; updated_at: string };

export function lerLogo(c: Consulta) {
  return one<LogoLinha>(c, "SELECT nome, mime, bytes, hash, updated_at::text AS updated_at FROM entidade_logo WHERE id = 1");
}

export function infoLogo(c: Consulta) {
  return one<{ nome: string; mime: string; hash: string; updated_at: string; tamanho: number }>(c,
    "SELECT nome, mime, hash, updated_at::text AS updated_at, octet_length(bytes)::int AS tamanho FROM entidade_logo WHERE id = 1");
}

export async function gravarLogo(c: Consulta, d: { nome: string; mime: string; bytes: Buffer; hash: string }) {
  await many(c,
    `INSERT INTO entidade_logo (id, nome, mime, bytes, hash, updated_at) VALUES (1, $1, $2, $3, $4, now())
     ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, mime = EXCLUDED.mime, bytes = EXCLUDED.bytes,
       hash = EXCLUDED.hash, updated_at = now()`,
    [d.nome, d.mime, d.bytes, d.hash]);
}

export async function apagarLogo(c: Consulta) {
  await many(c, "DELETE FROM entidade_logo WHERE id = 1");
}
