/** Despesas da Financiada (template de despesas). */
import { many, one, type Consulta } from "./sql.js";

export type LinhaDespesa = { id: number; ordem: number; dados: Record<string, unknown>; atualizado_em: string };

const COLUNAS = "id, ordem, dados, atualizado_em::text AS atualizado_em";

export function listarDespesas(c: Consulta) {
  return many<LinhaDespesa>(c, `SELECT ${COLUNAS} FROM despesas_fin ORDER BY ordem, id`);
}

/** A ordem é a seguinte à maior (a numeração do template). */
export function criarDespesa(c: Consulta, dados: unknown, actorId: string) {
  return one<LinhaDespesa>(c,
    `INSERT INTO despesas_fin (ordem, dados, criado_por)
     VALUES ((SELECT COALESCE(max(ordem), 0) + 1 FROM despesas_fin), $1::jsonb, $2)
     RETURNING ${COLUNAS}`,
    [JSON.stringify(dados), actorId]);
}

export function alterarDespesa(c: Consulta, id: number, dados: unknown) {
  return one<LinhaDespesa>(c,
    `UPDATE despesas_fin SET dados = $2::jsonb, atualizado_em = now() WHERE id = $1 RETURNING ${COLUNAS}`,
    [id, JSON.stringify(dados)]);
}

export async function apagarDespesa(c: Consulta, id: number) {
  return Boolean(await one(c, "DELETE FROM despesas_fin WHERE id = $1 RETURNING id", [id]));
}
