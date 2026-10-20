/**
 * Pagamento ligado à pré-inscrição (Gold): criar o pagamento pendente, alinhar o valor
 * e marcar o pedido. Pagamento por transferência com comprovativo: sem referências Multibanco.
 */
import { many, one, type Consulta } from "./sql.js";

type Linha = Record<string, unknown>;

export async function pagamento(c: Consulta, id: string) {
  return one<Linha>(c, "SELECT * FROM pagamentos WHERE id = $1", [id]);
}

export async function actualizarValorPendente(c: Consulta, id: string, valor: number) {
  await many(c, "UPDATE pagamentos SET valor = $2 WHERE id = $1 AND estado <> 'Pago'", [id, valor]);
}

/** Último pagamento ainda não pago do mesmo email e curso (evita pagamentos repetidos). */
export async function pendenteDoEmailCurso(c: Consulta, email: string, curso: string) {
  return one<Linha>(c,
    `SELECT * FROM pagamentos
      WHERE estado <> 'Pago' AND lower(email) = $1 AND curso = $2
      ORDER BY data DESC LIMIT 1`,
    [email, curso]);
}

export async function criarPagamento(
  c: Consulta,
  p: { id: string; nome: string; valor: number; metodo: string; curso: string; data: string; email: string },
) {
  await many(c,
    "INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email, referencia) VALUES ($1,$2,$3,$4,$5,$6,'Pendente',$7,'')",
    [p.id, p.nome, p.valor, p.metodo, p.curso, p.data, p.email]);
}

export async function definirMetodoPendente(c: Consulta, id: string, metodo: string) {
  await many(c, "UPDATE pagamentos SET metodo = $2 WHERE id = $1 AND estado <> 'Pago'", [id, metodo]);
}

/** Liga o pagamento à pré-inscrição (só se ainda não tiver um, quando `seVazio`). */
export async function ligarAoLead(c: Consulta, leadId: number, pagamentoId: string, seVazio = false) {
  await many(c,
    seVazio
      ? "UPDATE preinscricoes SET pagamento_id = $2 WHERE id = $1 AND (pagamento_id IS NULL OR pagamento_id = '')"
      : "UPDATE preinscricoes SET pagamento_id = $2 WHERE id = $1",
    [leadId, pagamentoId]);
}

export async function alinharPreco(c: Consulta, leadId: number, preco: number) {
  await many(c, "UPDATE preinscricoes SET preco = $2 WHERE id = $1", [leadId, preco]);
}

/** Marca o pedido e fixa a turma cujo preço foi pedido (a inscrição paga conclui nessa turma). */
export async function marcarPagamentoPedido(c: Consulta, leadId: number) {
  await many(c,
    `UPDATE preinscricoes SET pagamento_pedido_em = now(), ultima_actividade_em = now(),
       pagamento_turma_id = COALESCE(turma_escolhida_id, pagamento_turma_id)
     WHERE id = $1`, [leadId]);
}

export async function marcarLeadPago(c: Consulta, leadId: number) {
  await many(c, "UPDATE preinscricoes SET estado = 'Pago' WHERE id = $1 AND estado NOT IN ('Formando', 'Pago')", [leadId]);
}
