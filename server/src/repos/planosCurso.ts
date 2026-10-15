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
