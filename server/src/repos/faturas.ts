/** Faturas dos pagamentos (o PDF anexado pela contabilidade). */
import { one, type Consulta } from "./sql.js";

export type FaturaRow = {
  pagamento_id: string; numero: string; drive_file_id: string; nome: string;
  anexada_em: string; enviada_em: string | null; enviada_para: string;
};

const COLUNAS = `pagamento_id, numero, drive_file_id, nome, anexada_em::text AS anexada_em, enviada_em::text AS enviada_em, enviada_para`;

export function faturaDoPagamento(c: Consulta, pagamentoId: string) {
  return one<FaturaRow>(c, `SELECT ${COLUNAS} FROM faturas WHERE pagamento_id = $1`, [pagamentoId]);
}

/** Anexa (ou substitui) a fatura: a nova ainda não foi enviada. */
export function gravarFatura(c: Consulta, f: { pagamentoId: string; numero: string; driveFileId: string; nome: string; actorId: string | null }) {
  return one<FaturaRow>(c,
    `INSERT INTO faturas (pagamento_id, numero, drive_file_id, nome, anexada_por) VALUES ($1, $2, $3, $4, $5::uuid)
     ON CONFLICT (pagamento_id) DO UPDATE
       SET numero = EXCLUDED.numero, drive_file_id = EXCLUDED.drive_file_id, nome = EXCLUDED.nome, anexada_por = EXCLUDED.anexada_por,
           anexada_em = now(), enviada_em = NULL, enviada_para = ''
     RETURNING ${COLUNAS}`,
    [f.pagamentoId, f.numero, f.driveFileId, f.nome, f.actorId]);
}

export function marcarEnviada(c: Consulta, pagamentoId: string, para: string) {
  return one<FaturaRow>(c,
    `UPDATE faturas SET enviada_em = now(), enviada_para = $2 WHERE pagamento_id = $1 RETURNING ${COLUNAS}`,
    [pagamentoId, para]);
}
