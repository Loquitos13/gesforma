import type { Db, TxQuery } from "./db/pool.js";

/**
 * Vagas de uma turma, contadas a partir dos formandos reais (não do contador gravado pelo cliente).
 * Todas as inscrições — backoffice Gold/Financiada, pipeline fin e validação de pré-inscrição —
 * passam por `garantirVaga` dentro de uma transacção, com a linha da turma trancada.
 */

export type Regime = "gold" | "fin";

export class InscricaoErro extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409 = 409) {
    super(message);
  }
}

const T = {
  gold: { turmas: "turmas_gold", formandos: "formandos_gold", capacidade: "vagas", contador: "total_alunos" },
  fin: { turmas: "turmas_fin", formandos: "formandos_fin", capacidade: "alunos_total", contador: "alunos" },
} as const;

/** Formandos que ocupam vaga: todos menos desistentes e indeferidos. */
const OCUPA = "NOT (lower(coalesce(estado, '')) LIKE 'desist%' OR lower(coalesce(estado, '')) = 'indeferido')";

export async function contarInscritos(q: TxQuery, regime: Regime, turmaId: number, excluirFormandoId?: number) {
  const t = T[regime];
  const r = await q<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${t.formandos} WHERE turma_id = $1 AND ${OCUPA} AND ($2::int IS NULL OR id <> $2::int)`,
    [turmaId, excluirFormandoId ?? null],
  );
  return Number(r.rows[0]?.n ?? 0);
}

/**
 * Reservas: pré-inscrições já validadas para esta turma que ainda não têm ficha de formando
 * (na Gold a secretaria inscreve à mão depois de validar). Ocupam vaga até passarem a formando.
 * SQL partilhado com a escolha pública de turma.
 */
export function sqlReservas(regime: Regime, turmaRef: string, emailExcluido = "NULL") {
  const t = T[regime];
  return `(SELECT count(*)::int FROM preinscricoes p
            WHERE p.turma_escolhida_id = ${turmaRef}
              AND COALESCE(p.regime, 'gold') = '${regime}'
              AND p.validada_em IS NOT NULL AND p.estado <> 'Desistiu'
              AND (${emailExcluido}::text IS NULL OR lower(p.email) <> ${emailExcluido}::text)
              AND NOT EXISTS (SELECT 1 FROM ${t.formandos} f
                               WHERE f.turma_id = ${turmaRef} AND p.email <> '' AND lower(f.email) = lower(p.email)))`;
}

export async function contarReservas(q: TxQuery, regime: Regime, turmaId: number, emailExcluido?: string) {
  const r = await q<{ n: number }>(`SELECT ${sqlReservas(regime, "$1", "$2")} AS n`, [turmaId, emailExcluido?.trim().toLowerCase() || null]);
  return Number(r.rows[0]?.n ?? 0);
}

/**
 * Tranca a turma e confirma que há lugar (capacidade + tolerância) e que o email ainda não está inscrito.
 * Lança `InscricaoErro` com a mensagem para o utilizador.
 */
export async function garantirVaga(
  q: TxQuery,
  regime: Regime,
  turmaId: number,
  opts: { email?: string; excluirFormandoId?: number } = {},
) {
  const t = T[regime];
  const turma = await q<{ id: number; nome: string; capacidade: number; tolerancia: number; fechada_em: unknown }>(
    `SELECT id, nome, ${t.capacidade} AS capacidade, COALESCE(tolerancia_vagas, 0) AS tolerancia, fechada_em
       FROM ${t.turmas} WHERE id = $1 FOR UPDATE`,
    [turmaId],
  );
  const row = turma.rows[0];
  if (!row) throw new InscricaoErro("Turma inexistente.", 404);
  if (row.fechada_em) throw new InscricaoErro("A turma está fechada: não aceita inscrições.");
  const email = (opts.email ?? "").trim().toLowerCase();
  if (email) {
    const dup = await q(
      `SELECT 1 FROM ${t.formandos} WHERE turma_id = $1 AND lower(email) = $2 AND ${OCUPA} AND ($3::int IS NULL OR id <> $3::int) LIMIT 1`,
      [turmaId, email, opts.excluirFormandoId ?? null],
    );
    if (dup.rows[0]) throw new InscricaoErro("Este formando já está inscrito nesta turma.");
  }
  const limite = Number(row.capacidade) + Math.max(0, Number(row.tolerancia) || 0);
  // A reserva do próprio email não conta: é ela que se está a converter em formando.
  const ocupadas = await contarInscritos(q, regime, turmaId, opts.excluirFormandoId)
    + await contarReservas(q, regime, turmaId, email || undefined);
  if (limite > 0 && ocupadas >= limite) {
    throw new InscricaoErro(`A turma ${row.nome} está cheia (${ocupadas}/${limite}).`);
  }
  return { nome: String(row.nome), ocupadas, limite };
}

/** Recalcula o contador gravado na turma, usado pelo site e pelos painéis. */
export async function recontarTurma(q: TxQuery, regime: Regime, turmaId: number | null | undefined) {
  if (turmaId == null || !Number.isFinite(Number(turmaId))) return;
  const t = T[regime];
  const n = await contarInscritos(q, regime, Number(turmaId));
  await q(`UPDATE ${t.turmas} SET ${t.contador} = $2 WHERE id = $1`, [turmaId, n]);
}

/** Versão fora de transacção, para depois de apagar ou mover um formando. */
export async function recontar(db: Db, regime: Regime, ...turmaIds: Array<number | null | undefined>) {
  const ids = [...new Set(turmaIds.filter((x): x is number => x != null && Number.isFinite(Number(x))).map(Number))];
  if (!ids.length) return;
  await db.tx(async q => {
    for (const id of ids) await recontarTurma(q, regime, id);
  });
}

/** Recalcula todas as turmas (arranque e migrações). */
export async function recontarTodas(db: Db) {
  for (const regime of ["gold", "fin"] as const) {
    const t = T[regime];
    await db.query(
      `UPDATE ${t.turmas} tt SET ${t.contador} = (
         SELECT count(*)::int FROM ${t.formandos} f WHERE f.turma_id = tt.id AND ${OCUPA.replace(/estado/g, "f.estado")}
       )`,
    );
  }
}
