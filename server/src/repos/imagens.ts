/** Imagens dos cursos, do topo do site (hero) e do blog. Os bytes ficam na base de dados. */
import { many, one, type Consulta, type Regime } from "./sql.js";

type Linha = { token: string; updated_at: string | Date };

/** Grava (ou substitui) a imagem de um slot. O token mantém-se para não partir ligações já publicadas. */
export async function gravarImagemCurso(
  c: Consulta,
  d: { regime: Regime; cursoId: number; slot: string; nome: string; mime: string; bytes: Buffer; token: string },
) {
  await many(c,
    `INSERT INTO curso_imagens (regime, curso_id, slot, nome, mime, bytes, token, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (regime, curso_id, slot) DO UPDATE SET
       nome = EXCLUDED.nome, mime = EXCLUDED.mime, bytes = EXCLUDED.bytes,
       token = COALESCE(NULLIF(curso_imagens.token, ''), EXCLUDED.token), updated_at = now()`,
    [d.regime, d.cursoId, d.slot, d.nome, d.mime, d.bytes, d.token]);
  return one<Linha>(c, "SELECT token, updated_at FROM curso_imagens WHERE regime = $1 AND curso_id = $2 AND slot = $3",
    [d.regime, d.cursoId, d.slot]);
}

export async function apagarMiniatura(c: Consulta, regime: Regime, cursoId: number) {
  await many(c, "DELETE FROM curso_imagens WHERE regime = $1 AND curso_id = $2 AND slot = 'miniatura'", [regime, cursoId]);
}

/** Guarda a referência da imagem na ficha do curso (a capa nova apaga a miniatura antiga). */
export async function ligarImagemNaFicha(c: Consulta, regime: Regime, cursoId: number, slot: string, nome: string, url: string) {
  await many(c,
    `INSERT INTO curso_fichas (regime, curso_id, payload)
     VALUES ($1, $2, jsonb_build_object($3::text, jsonb_build_object('name', $4::text, 'url', $5::text)))
     ON CONFLICT (regime, curso_id) DO UPDATE SET
       payload = CASE WHEN $3::text = 'capa'
         THEN ((COALESCE(curso_fichas.payload, '{}'::jsonb) - 'miniatura') || jsonb_build_object($3::text, jsonb_build_object('name', $4::text, 'url', $5::text)))
         ELSE (COALESCE(curso_fichas.payload, '{}'::jsonb) || jsonb_build_object($3::text, jsonb_build_object('name', $4::text, 'url', $5::text)))
       END,
       updated_at = now()`,
    [regime, cursoId, slot, nome, url]);
}

export async function gravarImagemBlog(c: Consulta, d: { token: string; nome: string; mime: string; bytes: Buffer }) {
  await many(c, "INSERT INTO blog_imagens (token, nome, mime, bytes) VALUES ($1, $2, $3, $4)", [d.token, d.nome, d.mime, d.bytes]);
}

export async function imagemPorToken(c: Consulta, token: string) {
  return (await one<{ mime: string; bytes: unknown }>(c, "SELECT mime, bytes FROM curso_imagens WHERE token = $1", [token]))
    ?? one<{ mime: string; bytes: unknown }>(c, "SELECT mime, bytes FROM blog_imagens WHERE token = $1", [token]);
}

export async function todasImagensCurso(c: Consulta) {
  return many<{ regime: string; curso_id: number; slot: string; token: string; updated_at: string | Date }>(c,
    "SELECT regime, curso_id, slot, token, updated_at FROM curso_imagens");
}

export async function imagensDoCurso(c: Consulta, regime: Regime, cursoId: number) {
  return many<{ slot: string; token: string; updated_at: string | Date }>(c,
    "SELECT slot, token, updated_at FROM curso_imagens WHERE regime = $1 AND curso_id = $2", [regime, cursoId]);
}
