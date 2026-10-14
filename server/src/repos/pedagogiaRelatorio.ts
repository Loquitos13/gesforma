/** Dados para o relatório final da acção (Financiada). */
import { many, one, type Consulta } from "./sql.js";

export async function turmaFinParaRelatorio(c: Consulta, turmaId: number) {
  return one<{
    nome: string; curso: string; local: string; horario: string; formador: string;
    formadores: unknown; data_inicio: string; horas: number; cronograma: unknown;
  }>(
    c,
    "SELECT nome, curso, local, horario, formador, formadores, data_inicio, horas, cronograma FROM turmas_fin WHERE id = $1",
    [turmaId],
  );
}

export async function sessoesFinParaRelatorio(c: Consulta, turmaId: number) {
  return many<{ presencas: unknown; sumario: unknown }>(
    c,
    "SELECT presencas, sumario FROM turma_sessoes WHERE regime = 'fin' AND turma_id = $1 ORDER BY sessao_n",
    [turmaId],
  );
}

export async function formandosFinParaRelatorio(c: Consulta, turmaId: number, turmaNome: string) {
  return many<{ id: number; nome: string; apelido: string; estado: string }>(
    c,
    `SELECT id, nome, apelido, estado FROM formandos_fin
      WHERE turma_id = $1 OR (turma_id IS NULL AND turma = $2)
      ORDER BY nome`,
    [turmaId, turmaNome],
  );
}

export async function notasFin(c: Consulta, turmaId: number) {
  return many<{ formando_id: number; nota: number }>(
    c,
    "SELECT formando_id, nota FROM turma_avaliacoes WHERE regime = 'fin' AND turma_id = $1 AND nota IS NOT NULL",
    [turmaId],
  );
}

export async function certificadosFin(c: Consulta, turmaId: number) {
  return many<{ formando_id: number; emitido: boolean; nota: number | null; ficheiro_id: string }>(
    c,
    "SELECT formando_id, emitido, nota, COALESCE(ficheiro_id, '') AS ficheiro_id FROM turma_certificados WHERE regime = 'fin' AND turma_id = $1",
    [turmaId],
  );
}

/** Ficha do curso financiado pelo nome comercial ou pela UFCD. */
export async function fichaCursoFinPorNome(c: Consulta, curso: string) {
  return one<{ payload: unknown }>(
    c,
    `SELECT f.payload FROM curso_fichas f
       JOIN cursos_fin c ON c.id = f.curso_id AND f.regime = 'fin'
      WHERE lower(trim(c.nome_comercial)) = lower(trim($1))
         OR lower(trim(c.ufcd)) = lower(trim($1))
      LIMIT 1`,
    [curso],
  );
}
