/** Formandos: escritas (criar, alterar, apagar, pagamento registado à mão). */
import type { TxQuery } from "../db/pool.js";
import { one, tabelaRegime, type Consulta, type Regime } from "./sql.js";

export async function turmaGoldBasica(c: Consulta, id: number) {
  return one<{ nome: string; curso: string; local: string; horario: string }>(
    c, "SELECT nome, curso, local, horario FROM turmas_gold WHERE id = $1", [id],
  );
}

export async function turmaFinPorNome(c: Consulta, nome: string) {
  return one<{ id: number; nome: string; curso: string }>(
    c, "SELECT id, nome, curso FROM turmas_fin WHERE lower(trim(nome)) = lower(trim($1)) ORDER BY id DESC LIMIT 1", [nome],
  );
}

export async function turmaFinPorId(c: Consulta, id: number) {
  return one<{ id: number; nome: string; curso: string }>(c, "SELECT id, nome, curso FROM turmas_fin WHERE id = $1", [id]);
}

export type NovoFormandoGold = {
  id: number; nome: string; apelido: string; telf: string; email: string; inscrito: string; local: string; curso: string;
  turma: string; turmaId: number | null; estado: string; pago: boolean; valor: number; metodo: string; piiEnc: string; publicId: string;
};

export async function inserirFormandoGold(q: TxQuery, d: NovoFormandoGold) {
  await q(
    `INSERT INTO formandos_gold (id, nome, apelido, telf, email, inscrito, local, curso, turma, turma_id, estado, pago, valor, metodo, pii_enc, public_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [d.id, d.nome, d.apelido, d.telf, d.email, d.inscrito, d.local, d.curso, d.turma, d.turmaId, d.estado, d.pago, d.valor, d.metodo, d.piiEnc, d.publicId],
  );
}

export type AlteracaoFormandoGold = Partial<{
  nome: string; apelido: string; telf: string; email: string; local: string; curso: string; turma: string; turmaId: number;
  estado: string; pago: boolean; valor: number; metodo: string; piiEnc: string;
}>;

export async function atualizarFormandoGold(c: Consulta, id: number, d: AlteracaoFormandoGold, publicId: string) {
  await one(
    c,
    `UPDATE formandos_gold SET
       nome = COALESCE($2, nome), apelido = COALESCE($3, apelido), telf = COALESCE($4, telf),
       email = COALESCE($5, email), local = COALESCE($6, local), curso = COALESCE($7, curso),
       turma = COALESCE($8, turma), turma_id = COALESCE($9, turma_id), estado = COALESCE($10, estado),
       pago = COALESCE($11, pago), valor = COALESCE($12, valor), metodo = COALESCE($13, metodo),
       pii_enc = COALESCE($14, pii_enc),
       public_id = CASE WHEN COALESCE(public_id, '') = '' THEN $15 ELSE public_id END
     WHERE id = $1`,
    [
      id, d.nome ?? null, d.apelido ?? null, d.telf ?? null, d.email ?? null, d.local ?? null, d.curso ?? null,
      d.turma ?? null, d.turmaId ?? null, d.estado ?? null, d.pago ?? null, d.valor ?? null, d.metodo ?? null,
      d.piiEnc ?? null, publicId,
    ],
  );
}

export type NovoFormandoFin = {
  id: number; nome: string; apelido: string; turma: string; turmaId: number | null; telf: string; email: string;
  curso: string; estado: string; docs: unknown; docsEnc: string | null; piiEnc: string; publicId: string;
};

export async function inserirFormandoFin(q: TxQuery, d: NovoFormandoFin) {
  await q(
    `INSERT INTO formandos_fin (id, nome, apelido, turma, turma_id, telf, email, curso, estado, docs, docs_enc, pii_enc, public_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13)`,
    [d.id, d.nome, d.apelido, d.turma, d.turmaId, d.telf, d.email, d.curso, d.estado, JSON.stringify(d.docs ?? {}), d.docsEnc, d.piiEnc, d.publicId],
  );
}

export type AlteracaoFormandoFin = Partial<{
  nome: string; apelido: string; turma: string; telf: string; email: string; curso: string; estado: string;
}> & { docs: unknown; docsEnc: string | null; piiEnc: string | null };

export async function atualizarFormandoFin(c: Consulta, id: number, d: AlteracaoFormandoFin, publicId: string) {
  await one(
    c,
    `UPDATE formandos_fin SET nome = COALESCE($2, nome), apelido = COALESCE($3, apelido), turma = COALESCE($4, turma),
       telf = COALESCE($5, telf), email = COALESCE($6, email), curso = COALESCE($7, curso), estado = COALESCE($8, estado),
       docs = $9::jsonb, docs_enc = COALESCE($10, docs_enc), pii_enc = COALESCE($11, pii_enc),
       docs_sincronizados = false,
       public_id = CASE WHEN COALESCE(public_id, '') = '' THEN $12 ELSE public_id END
     WHERE id = $1`,
    [
      id, d.nome ?? null, d.apelido ?? null, d.turma ?? null, d.telf ?? null, d.email ?? null, d.curso ?? null, d.estado ?? null,
      JSON.stringify(d.docs ?? {}), d.docsEnc, d.piiEnc, publicId,
    ],
  );
}

export async function definirTurmaFin(c: Consulta, id: number, turmaId: number | null) {
  await one(c, "UPDATE formandos_fin SET turma_id = $2 WHERE id = $1", [id, turmaId]);
}

/** Apaga a ficha e devolve o que lá estava (para recontar a turma e auditar). */
export async function apagarFormando(c: Consulta, regime: Regime, id: number) {
  return one<{ turma_id: number | null; nome: string; apelido: string }>(
    c, `DELETE FROM ${tabelaRegime("formandos", regime)} WHERE id = $1 RETURNING turma_id, nome, apelido`, [id],
  );
}

export async function dadosBasicos(c: Consulta, regime: Regime, id: number) {
  return one<{ nome: string; apelido: string; email: string; curso: string; turma: string; turma_id: number | null; estado: string; metodo: string; valor: unknown; pago: boolean }>(
    c,
    `SELECT nome, apelido, email, curso, turma, turma_id, estado,
            ${regime === "gold" ? "metodo, valor, pago" : "'Financiada' AS metodo, 0 AS valor, true AS pago"}
       FROM ${tabelaRegime("formandos", regime)} WHERE id = $1`,
    [id],
  );
}

/** Pagamento pendente do formando Gold (um só em aberto): cria-o ou actualiza o valor. */
export async function garantirPagamentoPendente(
  c: Consulta,
  d: { novoId: string; formandoId: number; turmaId: number | null; nome: string; email: string; curso: string; valor: number; data: string },
) {
  const aberto = await one<{ id: string }>(
    c, "SELECT id FROM pagamentos WHERE formando_id = $1 AND estado = 'Pendente' ORDER BY id DESC LIMIT 1", [d.formandoId],
  );
  if (aberto) {
    await one(c, "UPDATE pagamentos SET valor = $2, metodo = 'Transferência bancária' WHERE id = $1", [aberto.id, d.valor]);
    return aberto.id;
  }
  await one(
    c,
    `INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email, referencia, formando_id, turma_id)
     VALUES ($1,$2,$3,'Transferência bancária',$4,$5,'Pendente',$6,'',$7,$8)`,
    [d.novoId, d.nome, d.valor, d.curso, d.data, d.email, d.formandoId, d.turmaId],
  );
  return d.novoId;
}

/** A ficha tem um pagamento recebido (para não a desmarcar sem reembolsar ou cancelar). */
export async function temPagamentoPago(c: Consulta, formandoId: number) {
  return Boolean(await one(c, "SELECT 1 FROM pagamentos WHERE formando_id = $1 AND estado = 'Pago' LIMIT 1", [formandoId]));
}

/**
 * Pagamento recebido e registado pela secretaria: fecha o pendente (ou cria um movimento pago)
 * e marca a ficha como paga. Devolve null se a ficha já estava paga (bloqueada até ao fim da transação).
 */
export async function registarPagamentoRecebido(
  q: TxQuery,
  d: { novoId: string; formandoId: number; turmaId: number | null; nome: string; email: string; curso: string; valor: number; metodo: string; data: string },
) {
  const ficha = await q<{ pago: boolean }>("SELECT pago FROM formandos_gold WHERE id = $1 FOR UPDATE", [d.formandoId]);
  if (ficha.rows[0]?.pago) return null;
  // Data escolhida pela secretaria (parâmetro próprio: o da coluna «data» é texto); se for hoje, fica a hora real.
  const pagoEm = (p: string) => `CASE WHEN ${p}::date = (now() AT TIME ZONE 'Europe/Lisbon')::date THEN now() ELSE ${p}::date::timestamp AT TIME ZONE 'Europe/Lisbon' END`;
  const aberto = await q<{ id: string }>(
    "SELECT id FROM pagamentos WHERE formando_id = $1 AND estado = 'Pendente' ORDER BY id DESC LIMIT 1", [d.formandoId],
  );
  const id = aberto.rows[0]?.id;
  if (id) {
    await q(
      `UPDATE pagamentos SET estado = 'Pago', valor = $2, metodo = $3, data = $4, pago_em = ${pagoEm("$5")} WHERE id = $1`,
      [id, d.valor, d.metodo, d.data, d.data],
    );
  } else {
    await q(
      `INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email, referencia, formando_id, turma_id, pago_em)
       VALUES ($1,$2,$3,$4,$5,$6,'Pago',$7,'',$8,$9, ${pagoEm("$10")})`,
      [d.novoId, d.nome, d.valor, d.metodo, d.curso, d.data, d.email, d.formandoId, d.turmaId, d.data],
    );
  }
  await q("UPDATE formandos_gold SET pago = true, valor = $2, metodo = $3 WHERE id = $1", [d.formandoId, d.valor, d.metodo]);
  return id ?? d.novoId;
}
