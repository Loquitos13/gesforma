/** Dados de faturação da inscrição (pedido por ligação pessoal; dados cifrados). */
import { one, type Consulta } from "./sql.js";

export type LinhaFaturacao = {
  preinscricao_id: number; token: string; dados_enc: string | null; pedido_em: string; preenchido_em: string | null;
  /** A ligação aceita dados: ainda não preenchida desde o último pedido e pedida há menos de 30 dias. */
  aberta: boolean;
};

const COLUNAS = `preinscricao_id, token, dados_enc, pedido_em::text AS pedido_em, preenchido_em::text AS preenchido_em,
  ((preenchido_em IS NULL OR preenchido_em < pedido_em) AND pedido_em > now() - interval '30 days') AS aberta`;

export async function faturacaoDoLead(c: Consulta, leadId: number) {
  return one<LinhaFaturacao>(c, `SELECT ${COLUNAS} FROM preinscricao_faturacao WHERE preinscricao_id = $1`, [leadId]);
}

export async function faturacaoPorToken(c: Consulta, token: string) {
  return one<LinhaFaturacao>(c, `SELECT ${COLUNAS} FROM preinscricao_faturacao WHERE token = $1`, [token]);
}

/**
 * Cria o pedido (um por inscrição). Se já existe, a secretaria volta a pedir: ligação nova (a anterior deixa de
 * abrir) e a data do pedido reabre-a, também para corrigir dados já enviados.
 */
export async function garantirPedido(c: Consulta, leadId: number, token: string) {
  return one<LinhaFaturacao>(c,
    `INSERT INTO preinscricao_faturacao (preinscricao_id, token) VALUES ($1, $2)
     ON CONFLICT (preinscricao_id) DO UPDATE SET pedido_em = now(), token = EXCLUDED.token
     RETURNING ${COLUNAS}`,
    [leadId, token]);
}

export async function gravarDados(c: Consulta, leadId: number, dadosEnc: string) {
  await one(c, "UPDATE preinscricao_faturacao SET dados_enc = $2, preenchido_em = now() WHERE preinscricao_id = $1 RETURNING preinscricao_id", [leadId, dadosEnc]);
}
