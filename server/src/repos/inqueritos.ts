/** Inquéritos: definição (catalog_items kind='inqueritos'), envios por turma e respostas. */
import { pgTextArray } from "../pedagogia/util.js";
import { many, one, valor, type Consulta, type Regime } from "./sql.js";

export type InqueritoLinha = { id: number; regime: Regime; payload: unknown; public_token: string | null };

export async function lerInquerito(c: Consulta, id: number) {
  return one<InqueritoLinha>(c, "SELECT id, regime, payload, public_token FROM catalog_items WHERE id = $1 AND kind = 'inqueritos'", [id]);
}

export async function inqueritoPorToken(c: Consulta, token: string) {
  return one<{ id: number; payload: unknown }>(c, "SELECT id, payload FROM catalog_items WHERE public_token = $1 AND kind = 'inqueritos'", [token]);
}

export async function gravarToken(c: Consulta, id: number, token: string) {
  await one(c, "UPDATE catalog_items SET public_token = $2, updated_at = now() WHERE id = $1 AND kind = 'inqueritos' RETURNING id", [id, token]);
}

export async function inqueritosDoRegime(c: Consulta, regime: Regime) {
  return many<InqueritoLinha>(
    c,
    "SELECT id, regime, payload, public_token FROM catalog_items WHERE kind = 'inqueritos' AND regime = $1 ORDER BY id",
    [regime],
  );
}

/**
 * Lista com contagens: turmas a que foi enviado, pessoas que o receberam,
 * respostas e última resposta. Tudo agregado em SQL.
 */
export async function listarComContagens(c: Consulta, regime: Regime) {
  return many<{
    id: number; payload: unknown; turmas: number; destinatarios: number; respostas: number;
    ultima_resposta: string | null; ultimo_envio: string | null;
  }>(
    c,
    `SELECT i.id, i.payload,
            coalesce(e.turmas, 0)::int AS turmas,
            coalesce(e.destinatarios, 0)::int AS destinatarios,
            coalesce(r.respostas, 0)::int AS respostas,
            r.ultima::text AS ultima_resposta,
            e.ultimo::text AS ultimo_envio
       FROM catalog_items i
       LEFT JOIN (
         SELECT inquerito_id, count(*) AS turmas, sum(destinatarios) AS destinatarios, max(enviado_em) AS ultimo
           FROM inquerito_envios WHERE regime = $1 GROUP BY inquerito_id
       ) e ON e.inquerito_id = i.id
       LEFT JOIN (
         SELECT inquerito_id, count(*) AS respostas, max(created_at) AS ultima
           FROM inquerito_respostas GROUP BY inquerito_id
       ) r ON r.inquerito_id = i.id
      WHERE i.kind = 'inqueritos' AND i.regime = $1
      ORDER BY i.id DESC`,
    [regime],
  );
}

/** Taxa de resposta por turma: envios (com nº de destinatários) cruzados com as respostas da turma. */
export async function resultadosPorTurma(c: Consulta, inqueritoId: number, regime: Regime, filtro: { turma?: string; curso?: string }) {
  const tabela = regime === "gold" ? "turmas_gold" : "turmas_fin";
  return many<{ turma_id: number | null; turma: string; curso: string; destinatarios: number; respostas: number; enviado_em: string | null }>(
    c,
    `WITH envios AS (
       SELECT e.turma_id, t.nome AS turma, t.curso, e.destinatarios, e.enviado_em
         FROM inquerito_envios e
         JOIN ${tabela} t ON t.id = e.turma_id
        WHERE e.inquerito_id = $1 AND e.regime = $2
     ), resp AS (
       SELECT lower(trim(turma)) AS chave, min(turma) AS turma, count(*) AS n
         FROM inquerito_respostas WHERE inquerito_id = $1 GROUP BY lower(trim(turma))
     )
     SELECT e.turma_id, coalesce(e.turma, r.turma, '') AS turma, coalesce(e.curso, '') AS curso,
            coalesce(e.destinatarios, 0)::int AS destinatarios, coalesce(r.n, 0)::int AS respostas,
            e.enviado_em::text AS enviado_em
       FROM envios e
       FULL JOIN resp r ON r.chave = lower(trim(e.turma))
      WHERE ($3::text IS NULL OR lower(trim(coalesce(e.turma, r.turma))) = lower(trim($3)))
        AND ($4::text IS NULL OR lower(trim(coalesce(e.curso, ''))) = lower(trim($4)))
      ORDER BY e.enviado_em DESC NULLS LAST, turma`,
    [inqueritoId, regime, filtro.turma ?? null, filtro.curso ?? null],
  );
}

export async function respostasDoInquerito(c: Consulta, inqueritoId: number, filtro: { turma?: string; turmas?: string[]; limite?: number } = {}) {
  return many<{ id: number; turma: string; formando: string; respostas: unknown; created_at: string | Date }>(
    c,
    `SELECT id, turma, formando, respostas, created_at
       FROM inquerito_respostas
      WHERE inquerito_id = $1
        AND ($2::text IS NULL OR lower(trim(turma)) = lower(trim($2)))
        AND ($3::text[] IS NULL OR lower(trim(turma)) = ANY($3::text[]))
      ORDER BY created_at DESC
      LIMIT $4`,
    [inqueritoId, filtro.turma ?? null, filtro.turmas ? pgTextArray(filtro.turmas.map(t => t.trim().toLowerCase())) : null, filtro.limite ?? 2000],
  );
}

export async function contarRespostas(c: Consulta, inqueritoId: number) {
  return Number(await valor<number>(c, "SELECT count(*)::int FROM inquerito_respostas WHERE inquerito_id = $1", [inqueritoId]) ?? 0);
}

export async function inserirResposta(c: Consulta, inqueritoId: number, r: { turma: string; formando: string; respostas: Record<string, unknown> }) {
  await one(
    c,
    "INSERT INTO inquerito_respostas (inquerito_id, turma, formando, respostas) VALUES ($1, $2, $3, $4::jsonb) RETURNING id",
    [inqueritoId, r.turma, r.formando, r.respostas],
  );
}

export async function registarEnvio(c: Consulta, regime: Regime, turmaId: number, inqueritoId: number, publico: string, destinatarios: number) {
  await one(
    c,
    `INSERT INTO inquerito_envios (regime, turma_id, inquerito_id, publico, destinatarios)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (regime, turma_id, inquerito_id) DO UPDATE SET
       publico = EXCLUDED.publico, destinatarios = EXCLUDED.destinatarios, enviado_em = now()
     RETURNING id`,
    [regime, turmaId, inqueritoId, publico, destinatarios],
  );
}

/** Inquéritos já enviados à turma (para os PDFs de perguntas). */
export async function inqueritosEnviados(c: Consulta, regime: Regime, turmaId: number) {
  return many<{ payload: unknown }>(
    c,
    `SELECT i.payload
       FROM catalog_items i
       JOIN inquerito_envios e ON e.inquerito_id = i.id AND e.regime = $1 AND e.turma_id = $2
      WHERE i.kind = 'inqueritos' AND i.regime = $1
      ORDER BY i.id`,
    [regime, turmaId],
  );
}

/** Respostas de todos os inquéritos do regime para uma turma (relatórios). */
export async function respostasDaTurma(c: Consulta, regime: Regime, turmaNome: string) {
  return many<{ id: number; titulo: string; publico: string; perguntas: unknown; formando: string; respostas: unknown }>(
    c,
    `SELECT i.id, i.payload->>'titulo' AS titulo,
            COALESCE(NULLIF(i.payload->>'publico', ''), 'formando') AS publico,
            i.payload->'perguntas' AS perguntas, r.formando, r.respostas
       FROM catalog_items i
       JOIN inquerito_respostas r ON r.inquerito_id = i.id
      WHERE i.kind = 'inqueritos' AND i.regime = $1
        AND lower(trim(r.turma)) = lower(trim($2))
      ORDER BY i.id, r.created_at`,
    [regime, turmaNome],
  );
}
