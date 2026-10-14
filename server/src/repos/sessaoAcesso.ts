/** Leituras para decidir o que o formador vê e grava: o seu nome, as turmas em que aparece, a sua ficha. */
import { many, one, tabelaRegime, type Consulta, type Regime } from "./sql.js";

/** Nomes do formador pela conta (`formadores.user_id`) ou pelo email. */
export async function nomesPorConta(c: Consulta, email: string, userId: string) {
  return many<{ nome: string }>(
    c,
    `SELECT nome FROM formadores
      WHERE ($2 <> '' AND user_id::text = $2)
         OR ($1 <> '' AND lower(email) = lower($1))`,
    [email.trim(), userId],
  );
}

export type EquipaTurma = { formador: unknown; formadores: unknown; cronograma: unknown };

export async function equipaECronograma(c: Consulta, regime: Regime, turmaId: number) {
  return one<EquipaTurma>(c, `SELECT formador, formadores, cronograma FROM ${tabelaRegime("turmas", regime)} WHERE id = $1`, [turmaId]);
}

export async function equipasDoRegime(c: Consulta, regime: Regime) {
  return many<EquipaTurma & { id: number }>(c, `SELECT id, formador, formadores, cronograma FROM ${tabelaRegime("turmas", regime)}`);
}

export async function fichaDaConta(c: Consulta, formadorId: number, userId: string, email: string) {
  return one<{ id: number }>(
    c,
    "SELECT id FROM formadores WHERE id = $1 AND (user_id::text = $2 OR ($3 <> '' AND lower(email) = lower($3)))",
    [formadorId, userId, email.trim()],
  );
}
