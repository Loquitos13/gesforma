/** Inquéritos: definição (catalog_items kind='inqueritos'), envios por turma e respostas. */
import { pgIntArray, pgTextArray } from "../pedagogia/util.js";
import { many, one, type Consulta, type Regime } from "./sql.js";

export type InqueritoLinha = { id: number; regime: Regime; payload: unknown; public_token: string | null };

export async function lerInquerito(c: Consulta, id: number) {
  return one<InqueritoLinha>(c, "SELECT id, regime, payload, public_token FROM catalog_items WHERE id = $1 AND kind = 'inqueritos'", [id]);
}

export async function inqueritoPorToken(c: Consulta, token: string) {
  return one<{ id: number; regime: Regime; payload: unknown }>(c, "SELECT id, regime, payload FROM catalog_items WHERE public_token = $1 AND kind = 'inqueritos'", [token]);
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

/**
 * Taxa de resposta por turma: envios (com nº de destinatários) cruzados com as respostas da turma.
 * A resposta conta pela turma_id da ligação; as antigas (sem turma_id) pelo nome escrito.
 */
export async function resultadosPorTurma(c: Consulta, inqueritoId: number, regime: Regime, filtro: { turma?: string; curso?: string }) {
  const tabela = regime === "gold" ? "turmas_gold" : "turmas_fin";
  return many<{ turma_id: number | null; turma: string; curso: string; destinatarios: number; respostas: number; enviado_em: string | null }>(
    c,
    `WITH envios AS (
       SELECT e.turma_id, t.nome AS turma, t.curso, e.destinatarios, e.enviado_em
         FROM inquerito_envios e
         JOIN ${tabela} t ON t.id = e.turma_id
        WHERE e.inquerito_id = $1 AND e.regime = $2
     ), resp_turma AS (
       SELECT coalesce(r.turma_id, (SELECT e.turma_id FROM envios e WHERE lower(trim(e.turma)) = lower(trim(r.turma)) ORDER BY e.turma_id LIMIT 1)) AS tid,
              r.turma
         FROM inquerito_respostas r WHERE r.inquerito_id = $1
     ), resp AS (
       SELECT tid, CASE WHEN tid IS NULL THEN lower(trim(turma)) END AS chave, min(turma) AS turma, count(*) AS n
         FROM resp_turma GROUP BY 1, 2
     )
     SELECT e.turma_id, coalesce(e.turma, r.turma, '') AS turma, coalesce(e.curso, '') AS curso,
            coalesce(e.destinatarios, 0)::int AS destinatarios, coalesce(r.n, 0)::int AS respostas,
            e.enviado_em::text AS enviado_em
       FROM envios e
       FULL JOIN resp r ON r.tid = e.turma_id
      WHERE ($3::text IS NULL OR lower(trim(coalesce(e.turma, r.turma))) = lower(trim($3)))
        AND ($4::text IS NULL OR lower(trim(coalesce(e.curso, ''))) = lower(trim($4)))
      ORDER BY e.enviado_em DESC NULLS LAST, turma`,
    [inqueritoId, regime, filtro.turma ?? null, filtro.curso ?? null],
  );
}

/**
 * Respostas do inquérito. Com filtro, contam as da turma (turma_id) e, só para as antigas sem turma_id,
 * as que têm o nome da turma escrito.
 */
export async function respostasDoInquerito(c: Consulta, inqueritoId: number, filtro: { turmaIds?: number[]; turmas?: string[]; limite?: number } = {}) {
  const filtrado = Boolean(filtro.turmaIds || filtro.turmas);
  return many<{ id: number; turma: string; turma_id: number | null; formando: string; respostas: unknown; created_at: string | Date }>(
    c,
    `SELECT id, turma, turma_id, formando, respostas, created_at
       FROM inquerito_respostas
      WHERE inquerito_id = $1
        AND (NOT $2::boolean
             OR turma_id = ANY($3::int[])
             OR (turma_id IS NULL AND lower(trim(turma)) = ANY($4::text[])))
      ORDER BY created_at DESC
      LIMIT $5`,
    [inqueritoId, filtrado, pgIntArray(filtro.turmaIds ?? []), pgTextArray((filtro.turmas ?? []).map(t => t.trim().toLowerCase())), filtro.limite ?? 2000],
  );
}

export async function inserirResposta(c: Consulta, inqueritoId: number, r: { turma: string; turmaId?: number | null; formando: string; respostas: Record<string, unknown> }) {
  await one(
    c,
    "INSERT INTO inquerito_respostas (inquerito_id, turma, turma_id, formando, respostas) VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id",
    [inqueritoId, r.turma, r.turmaId ?? null, r.formando, r.respostas],
  );
}

/** Turma a que o inquérito foi enviado (a ligação ?turma=<id> só vale para essas). */
export async function turmaDoEnvio(c: Consulta, inqueritoId: number, regime: Regime, turmaId: number) {
  const tabela = regime === "gold" ? "turmas_gold" : "turmas_fin";
  return one<{ id: number; nome: string; destinatarios: number; respostas: number }>(
    c,
    `SELECT t.id, t.nome, COALESCE(e.destinatarios, 0)::int AS destinatarios,
            (SELECT count(*)::int FROM inquerito_respostas r WHERE r.inquerito_id = e.inquerito_id AND r.turma_id = e.turma_id) AS respostas
       FROM inquerito_envios e
       JOIN ${tabela} t ON t.id = e.turma_id
      WHERE e.inquerito_id = $1 AND e.regime = $2 AND e.turma_id = $3`,
    [inqueritoId, regime, turmaId],
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

/** Respostas de todos os inquéritos do regime para uma turma (relatórios): pela turma_id; as antigas pelo nome. */
export async function respostasDaTurma(c: Consulta, regime: Regime, turmaId: number, turmaNome: string) {
  return many<{ id: number; titulo: string; publico: string; perguntas: unknown; formando: string; respostas: unknown }>(
    c,
    `SELECT i.id, i.payload->>'titulo' AS titulo,
            COALESCE(NULLIF(i.payload->>'publico', ''), 'formando') AS publico,
            i.payload->'perguntas' AS perguntas, r.formando, r.respostas
       FROM catalog_items i
       JOIN inquerito_respostas r ON r.inquerito_id = i.id
      WHERE i.kind = 'inqueritos' AND i.regime = $1
        AND (r.turma_id = $3 OR (r.turma_id IS NULL AND lower(trim(r.turma)) = lower(trim($2))))
      ORDER BY i.id, r.created_at`,
    [regime, turmaNome, turmaId],
  );
}
