/** Fim do percurso Gold pago: pré-inscrição → ficha de formando (inscricaoPaga.ts). */
import type { TxQuery } from "../db/pool.js";
import { one, type Consulta } from "./sql.js";

export async function leadComPagamentoPedido(c: Consulta, pagamentoId: string) {
  return one<{ id: number }>(
    c,
    `SELECT id FROM preinscricoes
      WHERE pagamento_id = $1 AND COALESCE(regime, 'gold') = 'gold' AND pagamento_pedido_em IS NOT NULL
      ORDER BY id DESC LIMIT 1`,
    [pagamentoId],
  );
}

export async function leadCompleto(c: Consulta, id: number) {
  return one<Record<string, unknown>>(c, "SELECT * FROM preinscricoes WHERE id = $1", [id]);
}

/** Pagamento pedido no percurso desta pré-inscrição Gold (id e estado). */
export async function pagamentoDoLead(c: Consulta, leadId: number) {
  return one<{ id: string; estado: string }>(c,
    `SELECT p.id, p.estado FROM preinscricoes l JOIN pagamentos p ON p.id = l.pagamento_id
      WHERE l.id = $1 AND COALESCE(l.regime, 'gold') = 'gold' AND l.pagamento_pedido_em IS NOT NULL`, [leadId]);
}

export async function pagamentoBasico(c: Consulta, id: string) {
  return one<{ valor: number; metodo: string }>(c, "SELECT valor, metodo FROM pagamentos WHERE id = $1", [id]);
}

export async function formandoGoldNaTurma(c: Consulta, email: string, turmaId: number) {
  return one<{ id: number }>(
    c, "SELECT id FROM formandos_gold WHERE lower(trim(email)) = $1 AND turma_id = $2 ORDER BY id DESC LIMIT 1", [email, turmaId],
  );
}

export async function turmaGoldParaInscricao(c: Consulta, turmaId: number) {
  return one<{ nome: string; curso: string; local: string }>(c, "SELECT nome, curso, local FROM turmas_gold WHERE id = $1", [turmaId]);
}

export async function inserirFormandoGoldPago(
  q: TxQuery,
  d: { id: number; nome: string; apelido: string; telf: string; email: string; inscrito: string; local: string; curso: string; turma: string; turmaId: number; valor: number; metodo: string; piiEnc: string; publicId: string },
) {
  await q(
    `INSERT INTO formandos_gold (id, nome, apelido, telf, email, inscrito, local, curso, turma, turma_id, estado, pago, valor, metodo, pii_enc, public_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'Formando',true,$11,$12,$13,$14)`,
    [d.id, d.nome, d.apelido, d.telf, d.email, d.inscrito, d.local, d.curso, d.turma, d.turmaId, d.valor, d.metodo, d.piiEnc, d.publicId],
  );
}

export async function nomeDoFormando(c: Consulta, regime: "gold" | "fin", id: number) {
  return one<{ nome: string; apelido: string; curso: string }>(
    c, `SELECT nome, apelido, curso FROM ${regime === "fin" ? "formandos_fin" : "formandos_gold"} WHERE id = $1`, [id],
  );
}
