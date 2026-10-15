/** Dados de faturação da inscrição (pedido por ligação pessoal; dados cifrados). */
import { one, type Consulta } from "./sql.js";

export type LinhaFaturacao = {
  preinscricao_id: number; token: string; dados_enc: string | null; pedido_em: string; preenchido_em: string | null;
};

const COLUNAS = "preinscricao_id, token, dados_enc, pedido_em::text AS pedido_em, preenchido_em::text AS preenchido_em";

export async function faturacaoDoLead(c: Consulta, leadId: number) {
  return one<LinhaFaturacao>(c, `SELECT ${COLUNAS} FROM preinscricao_faturacao WHERE preinscricao_id = $1`, [leadId]);
}

export async function faturacaoPorToken(c: Consulta, token: string) {
  return one<LinhaFaturacao>(c, `SELECT ${COLUNAS} FROM preinscricao_faturacao WHERE token = $1`, [token]);
}

/** Cria o pedido (um por inscrição); se já existe, só actualiza a data do pedido. */
export async function garantirPedido(c: Consulta, leadId: number, token: string) {
  return one<LinhaFaturacao>(c,
    `INSERT INTO preinscricao_faturacao (preinscricao_id, token) VALUES ($1, $2)
     ON CONFLICT (preinscricao_id) DO UPDATE SET pedido_em = now()
     RETURNING ${COLUNAS}`,
    [leadId, token]);
}

export async function gravarDados(c: Consulta, leadId: number, dadosEnc: string) {
  await one(c, "UPDATE preinscricao_faturacao SET dados_enc = $2, preenchido_em = now() WHERE preinscricao_id = $1 RETURNING preinscricao_id", [leadId, dadosEnc]);
}
