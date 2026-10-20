/** Despesas da Financiada (template de despesas), por turma. */
import { many, one, type Consulta } from "./sql.js";

export type OrigemDespesa = "manual" | "formador";

export type LinhaDespesa = {
  id: number; ordem: number; turma_id: number | null; dados: Record<string, unknown>; atualizado_em: string;
  origem: OrigemDespesa; formador: string | null; aviso: string;
};

const COLUNAS = "id, ordem, turma_id, dados, atualizado_em::text AS atualizado_em, origem, formador, aviso";
// A ordem é a seguinte à maior da turma (a numeração do template).
const PROXIMA = "(SELECT COALESCE(max(ordem), 0) + 1 FROM despesas_fin WHERE turma_id = $1)";

/** As despesas de uma turma; `null` = as antigas, ainda sem turma. */
export function listarDespesas(c: Consulta, turmaId: number | null) {
  return many<LinhaDespesa>(c, `SELECT ${COLUNAS} FROM despesas_fin WHERE turma_id IS NOT DISTINCT FROM $1 ORDER BY ordem, id`, [turmaId]);
}

export function obterDespesa(c: Consulta, id: number) {
  return one<LinhaDespesa>(c, `SELECT ${COLUNAS} FROM despesas_fin WHERE id = $1`, [id]);
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

/* ── Despesas automáticas dos formadores ─────────────────────────────────────── */

export type TurmaDespesasFormador = {
  id: number; nome: string; curso: string; ufcd_cod: string; formador: string; formadores: unknown;
  cronograma: unknown; valores_hora_formador: unknown; fechada_em: string | null;
};

export function turmaParaDespesasFormador(c: Consulta, turmaId: number) {
  return one<TurmaDespesasFormador>(c,
    `SELECT id, nome, COALESCE(curso, '') AS curso, COALESCE(ufcd_cod, '') AS ufcd_cod, COALESCE(formador, '') AS formador,
            formadores, cronograma, valores_hora_formador, fechada_em::text AS fechada_em
       FROM turmas_fin WHERE id = $1`,
    [turmaId]);
}

/** Nome, NIF e custo por hora das fichas destes formadores (nomes em minúsculas, sem espaços nas pontas). */
export function fichasDosFormadores(c: Consulta, nomes: string[]) {
  if (!nomes.length) return Promise.resolve([]);
  return many<{ nome: string; nif: string; custo_hora: string | number | null }>(c,
    `SELECT nome, COALESCE(nif, '') AS nif, custo_hora FROM formadores
      WHERE lower(trim(nome)) IN (SELECT lower(trim(x)) FROM jsonb_array_elements_text($1::jsonb) x)
      ORDER BY id`,
    [JSON.stringify(nomes)]);
}

export function despesasFormadorDaTurma(c: Consulta, turmaId: number) {
  return many<LinhaDespesa>(c, `SELECT ${COLUNAS} FROM despesas_fin WHERE turma_id = $1 AND origem = 'formador' ORDER BY ordem, id`, [turmaId]);
}

/** Nova linha automática no fim da numeração da turma; se outra sincronização já a criou, não faz nada. */
export function criarDespesaFormador(c: Consulta, turmaId: number, formador: string, dados: unknown) {
  return one<{ id: number }>(c,
    `INSERT INTO despesas_fin (turma_id, ordem, dados, origem, formador)
     VALUES ($1, ${PROXIMA}, $2::jsonb, 'formador', $3)
     ON CONFLICT (turma_id, (lower(formador))) WHERE origem = 'formador' DO NOTHING
     RETURNING id`,
    [turmaId, JSON.stringify(dados), formador]);
}

export function actualizarDespesaFormador(c: Consulta, id: number, formador: string, dados: unknown, aviso: string) {
  return one<{ id: number }>(c,
    "UPDATE despesas_fin SET dados = $2::jsonb, formador = $3, aviso = $4, atualizado_em = now() WHERE id = $1 RETURNING id",
    [id, JSON.stringify(dados), formador, aviso]);
}

export function marcarDespesaFormador(c: Consulta, id: number, aviso: string) {
  return one<{ id: number }>(c, "UPDATE despesas_fin SET aviso = $2, atualizado_em = now() WHERE id = $1 RETURNING id", [id, aviso]);
}

/** Uma linha automática que fica (a turma vai ser apagada) passa a despesa normal. */
export function tornarDespesaManual(c: Consulta, id: number) {
  return one<{ id: number }>(c, "UPDATE despesas_fin SET origem = 'manual', formador = NULL, aviso = '' WHERE id = $1 RETURNING id", [id]);
}

/** O formador mudou de nome: as suas linhas automáticas seguem-no (se a turma ainda não tem uma com o nome novo). */
export function renomearFormadorNasDespesas(c: Consulta, antigo: string, novo: string) {
  return many(c,
    `UPDATE despesas_fin d SET formador = $2
      WHERE d.origem = 'formador' AND lower(trim(d.formador)) = lower(trim($1))
        AND NOT EXISTS (SELECT 1 FROM despesas_fin o WHERE o.turma_id = d.turma_id AND o.origem = 'formador' AND lower(o.formador) = lower($2))`,
    [antigo, novo]);
}

/** Turmas da Financiada abertas onde o formador aparece (responsável, equipa, sessões) ou já tem despesa automática. */
export function turmasAbertasDoFormador(c: Consulta, nome: string) {
  return many<{ id: number }>(c,
    `SELECT t.id FROM turmas_fin t
      WHERE t.fechada_em IS NULL AND (
            lower(trim(COALESCE(t.formador, ''))) = $1
         OR strpos(lower(COALESCE(t.formadores::text, '')), $1) > 0
         OR strpos(lower(COALESCE(t.cronograma::text, '')), $1) > 0
         OR EXISTS (SELECT 1 FROM despesas_fin d WHERE d.turma_id = t.id AND d.origem = 'formador' AND lower(trim(d.formador)) = $1))
      ORDER BY t.id`,
    [nome.trim().toLowerCase()]);
}
