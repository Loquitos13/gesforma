/** Despesas da Financiada (template de despesas), por turma. */
import { many, one, type Consulta } from "./sql.js";

export type LinhaDespesa = { id: number; ordem: number; turma_id: number | null; dados: Record<string, unknown>; atualizado_em: string };

const COLUNAS = "id, ordem, turma_id, dados, atualizado_em::text AS atualizado_em";
// A ordem é a seguinte à maior da turma (a numeração do template).
const PROXIMA = "(SELECT COALESCE(max(ordem), 0) + 1 FROM despesas_fin WHERE turma_id = $1)";

/** As despesas de uma turma; `null` = as antigas, ainda sem turma. */
export function listarDespesas(c: Consulta, turmaId: number | null) {
  return many<LinhaDespesa>(c, `SELECT ${COLUNAS} FROM despesas_fin WHERE turma_id IS NOT DISTINCT FROM $1 ORDER BY ordem, id`, [turmaId]);
}

export function turmaDaDespesa(c: Consulta, turmaId: number) {
  return one<{ id: number; nome: string }>(c, "SELECT id, nome FROM turmas_fin WHERE id = $1", [turmaId]);
}

export function criarDespesa(c: Consulta, turmaId: number, dados: unknown, actorId: string) {
  return one<LinhaDespesa>(c,
    `INSERT INTO despesas_fin (turma_id, ordem, dados, criado_por) VALUES ($1, ${PROXIMA}, $2::jsonb, $3) RETURNING ${COLUNAS}`,
    [turmaId, JSON.stringify(dados), actorId]);
}

export function alterarDespesa(c: Consulta, id: number, dados: unknown) {
  return one<LinhaDespesa>(c,
    `UPDATE despesas_fin SET dados = $2::jsonb, atualizado_em = now() WHERE id = $1 RETURNING ${COLUNAS}`,
    [id, JSON.stringify(dados)]);
}

/** Uma despesa sem turma passa para a turma, no fim da numeração dela. */
export function associarDespesa(c: Consulta, id: number, turmaId: number) {
  return one<LinhaDespesa>(c,
    `UPDATE despesas_fin SET turma_id = $1, ordem = ${PROXIMA}, atualizado_em = now() WHERE id = $2 AND turma_id IS NULL RETURNING ${COLUNAS}`,
    [turmaId, id]);
}

/** Apaga e devolve a turma a que pertencia (`null` se não existia). */
export function apagarDespesa(c: Consulta, id: number) {
  return one<{ id: number; turma_id: number | null }>(c, "DELETE FROM despesas_fin WHERE id = $1 RETURNING id, turma_id", [id]);
}
