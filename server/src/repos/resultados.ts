/** Leituras para o cálculo dos resultados pedagógicos (nota, assiduidade, elegibilidade) e do fecho. */
import { pgIntArray } from "../pedagogia/util.js";
import { many, one, tabelaRegime, type Consulta, type Regime } from "./sql.js";

export type TurmaBase = { id: number; nome: string; curso: string; cronograma: unknown; fechada_em: unknown; curso_id: number | null };

export async function turmaBase(c: Consulta, regime: Regime, id: number) {
  return one<TurmaBase>(c, `SELECT id, nome, curso, cronograma, fechada_em, curso_id FROM ${tabelaRegime("turmas", regime)} WHERE id = $1`, [id]);
}

export async function turmaFechadaEm(c: Consulta, regime: Regime, id: number) {
  return one<{ fechada_em: unknown }>(c, `SELECT fechada_em FROM ${tabelaRegime("turmas", regime)} WHERE id = $1`, [id]);
}

/** Formandos da turma pelo id (as fichas antigas sem id contam pelo nome da turma). */
export async function formandosPorTurma(c: Consulta, regime: Regime, turma: { id: number; nome: string }) {
  return many<{ id: number; nome: string; apelido: string; estado: string }>(
    c,
    `SELECT id, nome, apelido, estado FROM ${tabelaRegime("formandos", regime)}
      WHERE turma_id = $1 OR (turma_id IS NULL AND lower(trim(turma)) = lower(trim($2)))
      ORDER BY nome, apelido`,
    [turma.id, turma.nome],
  );
}

/** Ficha do curso da turma: pelo id do curso, ou pelo nome (Gold) / nome comercial ou UFCD (Financiada). */
export async function fichaDoCursoDaTurma(c: Consulta, regime: Regime, turma: { curso: string; curso_id: number | null }) {
  if (turma.curso_id != null) {
    return one<{ payload: unknown }>(c, "SELECT payload FROM curso_fichas WHERE regime = $1 AND curso_id = $2", [regime, turma.curso_id]);
  }
  return regime === "gold"
    ? one<{ payload: unknown }>(
      c,
      `SELECT f.payload FROM curso_fichas f JOIN cursos_gold c ON c.id = f.curso_id AND f.regime = 'gold'
        WHERE lower(trim(c.nome)) = lower(trim($1)) LIMIT 1`,
      [turma.curso],
    )
    : one<{ payload: unknown }>(
      c,
      `SELECT f.payload FROM curso_fichas f JOIN cursos_fin c ON c.id = f.curso_id AND f.regime = 'fin'
        WHERE lower(trim(c.nome_comercial)) = lower(trim($1)) OR lower(trim(c.ufcd)) = lower(trim($1)) LIMIT 1`,
      [turma.curso],
    );
}

export async function folhasDePresenca(c: Consulta, regime: Regime, turmaId: number) {
  return many<{ sessao_n: number; presencas: unknown }>(
    c,
    "SELECT sessao_n, presencas FROM turma_sessoes WHERE regime = $1 AND turma_id = $2 AND sessao_n IS NOT NULL",
    [regime, turmaId],
  );
}

export async function certificadosParaResultados(c: Consulta, regime: Regime, turmaId: number) {
  return many<{ formando_id: number; emitido: boolean; elearning: unknown; nota: unknown; ficheiro_id: string }>(
    c,
    "SELECT formando_id, emitido, elearning, nota, COALESCE(ficheiro_id, '') AS ficheiro_id FROM turma_certificados WHERE regime = $1 AND turma_id = $2",
    [regime, turmaId],
  );
}

// ─── Em lote (várias turmas numa consulta por fonte) ─────────────────────────

export async function turmasBaseLote(c: Consulta, regime: Regime, ids: number[]) {
  if (!ids.length) return [];
  return many<TurmaBase>(
    c,
    `SELECT id, nome, curso, cronograma, fechada_em, curso_id FROM ${tabelaRegime("turmas", regime)} WHERE id = ANY($1::int[])`,
    [pgIntArray(ids)],
  );
}

/** Formandos candidatos às turmas: pelo id, ou sem id (fichas antigas, associadas depois pelo nome da turma). */
export async function formandosPorTurmasLote(c: Consulta, regime: Regime, ids: number[]) {
  if (!ids.length) return [];
  return many<{ id: number; nome: string; apelido: string; estado: string; turma_id: number | null; turma: string }>(
    c,
    `SELECT id, nome, apelido, estado, turma_id, coalesce(turma, '') AS turma FROM ${tabelaRegime("formandos", regime)}
      WHERE turma_id = ANY($1::int[]) OR turma_id IS NULL
      ORDER BY nome, apelido`,
    [pgIntArray(ids)],
  );
}

export async function folhasDePresencaLote(c: Consulta, regime: Regime, ids: number[]) {
  if (!ids.length) return [];
  return many<{ turma_id: number; sessao_n: number; presencas: unknown }>(
    c,
    "SELECT turma_id, sessao_n, presencas FROM turma_sessoes WHERE regime = $1 AND turma_id = ANY($2::int[]) AND sessao_n IS NOT NULL",
    [regime, pgIntArray(ids)],
  );
}

export async function notasLote(c: Consulta, regime: Regime, ids: number[]) {
  if (!ids.length) return [];
  return many<{ turma_id: number; formando_id: number; modulo_id: string; parametro_id: string; nota: unknown }>(
    c,
    "SELECT turma_id, formando_id, modulo_id, parametro_id, nota FROM turma_avaliacoes WHERE regime = $1 AND turma_id = ANY($2::int[])",
    [regime, pgIntArray(ids)],
  );
}

export async function certificadosParaResultadosLote(c: Consulta, regime: Regime, ids: number[]) {
  if (!ids.length) return [];
  return many<{ turma_id: number; formando_id: number; emitido: boolean; elearning: unknown; nota: unknown; ficheiro_id: string }>(
    c,
    `SELECT turma_id, formando_id, emitido, elearning, nota, COALESCE(ficheiro_id, '') AS ficheiro_id
       FROM turma_certificados WHERE regime = $1 AND turma_id = ANY($2::int[])`,
    [regime, pgIntArray(ids)],
  );
}

export async function fichasPorCursoIdLote(c: Consulta, regime: Regime, cursoIds: number[]) {
  if (!cursoIds.length) return [];
  return many<{ curso_id: number; payload: unknown }>(
    c,
    "SELECT curso_id, payload FROM curso_fichas WHERE regime = $1 AND curso_id = ANY($2::int[])",
    [regime, pgIntArray(cursoIds)],
  );
}
