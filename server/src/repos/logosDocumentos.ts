/** Logótipos dos documentos da Financiada (DGERT e um por programa): bytes na base de dados, por chave. */
import { many, one, type Consulta } from "./sql.js";

export function lerLogo(c: Consulta, chave: string) {
  return one<{ nome: string; mime: string; bytes: unknown; hash: string }>(c,
    "SELECT nome, mime, bytes, hash FROM logos_documentos WHERE chave = $1", [chave]);
}

export function infoLogo(c: Consulta, chave: string) {
  return one<{ nome: string; mime: string; hash: string; updated_at: string; tamanho: number }>(c,
    "SELECT nome, mime, hash, updated_at::text AS updated_at, octet_length(bytes)::int AS tamanho FROM logos_documentos WHERE chave = $1",
    [chave]);
}

export async function gravarLogo(c: Consulta, chave: string, d: { nome: string; mime: string; bytes: Buffer; hash: string }) {
  await many(c,
    `INSERT INTO logos_documentos (chave, nome, mime, bytes, hash, updated_at) VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (chave) DO UPDATE SET nome = EXCLUDED.nome, mime = EXCLUDED.mime, bytes = EXCLUDED.bytes,
       hash = EXCLUDED.hash, updated_at = now()`,
    [chave, d.nome, d.mime, d.bytes, d.hash]);
}

export async function apagarLogo(c: Consulta, chave: string) {
  await many(c, "DELETE FROM logos_documentos WHERE chave = $1", [chave]);
}
