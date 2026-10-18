/** Planos de sessão do curso levados para as turmas: turma (curso e cronograma) e turmas abertas do curso. */
import { many, one, tabelaRegime, type Consulta, type Regime } from "./sql.js";

export async function turmaParaPlanos(c: Consulta, regime: Regime, id: number) {
  return one<{ curso_id: number | null; curso: string; cronograma: unknown; fechada_em: unknown }>(c,
    `SELECT curso_id, curso, cronograma, fechada_em FROM ${tabelaRegime("turmas", regime)} WHERE id = $1`, [id]);
}

/** Turmas ainda abertas (não fechadas) ligadas a este curso. */
export async function turmasAbertasDoCurso(c: Consulta, regime: Regime, cursoId: number) {
  return (await many<{ id: number }>(c,
    `SELECT id FROM ${tabelaRegime("turmas", regime)} WHERE curso_id = $1 AND fechada_em IS NULL ORDER BY id`, [cursoId]))
    .map(r => Number(r.id));
}

/** Outras turmas do mesmo curso e do mesmo regime (de onde se podem copiar planos e sumários). */
export async function turmasDoMesmoCurso(c: Consulta, regime: Regime, id: number) {
  const t = tabelaRegime("turmas", regime);
  return many<{ id: number; nome: string; data_inicio: string }>(c,
    `SELECT o.id, o.nome, o.data_inicio::text AS data_inicio FROM ${t} o, ${t} a
      WHERE a.id = $1 AND o.id <> a.id AND lower(trim(o.curso)) = lower(trim(a.curso))
      ORDER BY o.data_inicio DESC NULLS LAST, o.id DESC LIMIT 100`, [id]);
}
