/** Recibos internos de pagamento e exportação da lista de pagamentos. */
import { Filtros, many, one, padraoPesquisa, type Consulta } from "./sql.js";
import type { FiltrosPagamentos } from "./pagamentos.js";

export type ReciboLinha = {
  id: number; pagamento_id: string; ano: number; numero: number; emitido_em: string; actualizado_em: string;
  drive_file_id: string; enviado_em: string | null; enviado_para: string;
};

const COLS = `id, pagamento_id, ano, numero, emitido_em::text AS emitido_em, actualizado_em::text AS actualizado_em,
  drive_file_id, enviado_em::text AS enviado_em, enviado_para`;

export function reciboDoPagamento(c: Consulta, pagamentoId: string) {
  return one<ReciboLinha>(c, `SELECT ${COLS} FROM recibos WHERE pagamento_id = $1`, [pagamentoId]);
}

/** Próximo número do ano, numa só instrução (seguro com pedidos em simultâneo). */
export async function proximoNumero(c: Consulta, ano: number) {
  const r = await one<{ ultimo: number }>(c,
    `INSERT INTO recibo_sequencias (ano, ultimo) VALUES ($1, 1)
     ON CONFLICT (ano) DO UPDATE SET ultimo = recibo_sequencias.ultimo + 1
     RETURNING ultimo`, [ano]);
  return Number(r?.ultimo ?? 1);
}

export async function inserirRecibo(c: Consulta, d: { pagamentoId: string; ano: number; numero: number; actorId: string | null; dados: unknown }) {
  return one<ReciboLinha>(c,
    `INSERT INTO recibos (pagamento_id, ano, numero, emitido_por, dados) VALUES ($1, $2, $3, $4, $5::jsonb)
     RETURNING ${COLS}`,
    [d.pagamentoId, d.ano, d.numero, d.actorId, JSON.stringify(d.dados ?? {})]);
}

export async function actualizarRecibo(c: Consulta, id: number, d: { dados?: unknown; driveFileId?: string }) {
  await many(c,
    `UPDATE recibos SET actualizado_em = now(),
       dados = COALESCE($2::jsonb, dados), drive_file_id = COALESCE($3, drive_file_id)
     WHERE id = $1`,
    [id, d.dados === undefined ? null : JSON.stringify(d.dados), d.driveFileId ?? null]);
}

export async function marcarEnviado(c: Consulta, id: number, para: string) {
  await many(c, "UPDATE recibos SET enviado_em = now(), enviado_para = $2 WHERE id = $1", [id, para]);
}

/** Dados do pagamento para o recibo: pessoa, NIF/morada (da pré-inscrição ligada), turma e quem confirmou. */
export type DadosReciboLinha = {
  id: string; nome: string; email: string; curso: string; valor: number; metodo: string; estado: string;
  pago_em: string | null; criado: string; turma: string | null; confirmado_por: string | null;
  lead_pii: string | null; lead_nif: string | null; lead_morada: string | null; lead_cp: string | null;
  formando_nome: string | null; regime: string | null;
};

export function dadosParaRecibo(c: Consulta, pagamentoId: string) {
  return one<DadosReciboLinha>(c,
    `SELECT p.id, p.nome, p.email, p.curso, p.valor::float AS valor, p.metodo, p.estado,
            p.pago_em::text AS pago_em, p.created_at::text AS criado,
            t.nome AS turma, u.name AS confirmado_por,
            lead.pii_enc AS lead_pii, lead.nif AS lead_nif, lead.morada_fiscal AS lead_morada, lead.codigo_postal AS lead_cp,
            NULLIF(trim(concat_ws(' ', f.nome, f.apelido)), '') AS formando_nome, COALESCE(lead.regime, 'gold') AS regime
       FROM pagamentos p
       LEFT JOIN turmas_gold t ON t.id = p.turma_id
       LEFT JOIN users u ON u.id = p.confirmado_por
       LEFT JOIN formandos_gold f ON f.id = p.formando_id
       LEFT JOIN LATERAL (
         SELECT l.pii_enc, l.nif, l.morada_fiscal, l.codigo_postal, l.regime FROM preinscricoes l
          WHERE l.pagamento_id = p.id ORDER BY l.id DESC LIMIT 1
       ) lead ON true
      WHERE p.id = $1`,
    [pagamentoId]);
}

// ─── Exportação ──────────────────────────────────────────────────────────────

export type LinhaExportacao = {
  id: string; criado: string; pago_em: string | null; nome: string; email: string; curso: string; turma: string | null;
  valor: number; metodo: string; estado: string; comprovativo: boolean; confirmado_por: string | null; recusa_motivo: string;
  lead_pii: string | null; lead_nif: string | null; recibo: string | null;
};

const SITUACAO = `CASE
  WHEN p.estado = 'Pago' THEN 'pago'
  WHEN p.estado = 'Cancelado' THEN 'cancelado'
  WHEN p.estado = 'Reembolsado' THEN 'reembolsado'
  WHEN comp.estado = 'pendente' AND (p.recusado_em IS NULL OR comp.created_at > p.recusado_em) THEN 'a_confirmar'
  WHEN p.recusado_em IS NOT NULL THEN 'recusado'
  ELSE 'pedido' END`;

/** Mesmos filtros da lista de pagamentos (`repos/pagamentos.ts`), sem paginação (até 10 000 linhas). */
export function linhasExportacao(c: Consulta, f: FiltrosPagamentos) {
  const w = new Filtros();
  w.add(`(${SITUACAO}) = ?`, f.situacao);
  w.add("p.curso = ?", f.curso);
  w.add("p.metodo = ?", f.metodo);
  w.add("COALESCE(p.pago_em, p.created_at) >= ?::date", f.de);
  w.add("COALESCE(p.pago_em, p.created_at) < (?::date + 1)", f.ate);
  const q = padraoPesquisa(f.q);
  w.add("(p.nome ILIKE ? OR p.email ILIKE ? OR p.curso ILIKE ? OR p.id ILIKE ?)", q, q, q, q);
  return many<LinhaExportacao>(c,
    `SELECT p.id, p.created_at::text AS criado, p.pago_em::text AS pago_em, p.nome, p.email, p.curso, t.nome AS turma,
            p.valor::float AS valor, p.metodo, p.estado, (comp.id IS NOT NULL) AS comprovativo, u.name AS confirmado_por,
            p.recusa_motivo, lead.pii_enc AS lead_pii, lead.nif AS lead_nif,
            CASE WHEN r.id IS NULL THEN NULL ELSE r.numero || '/' || r.ano END AS recibo
       FROM pagamentos p
       LEFT JOIN turmas_gold t ON t.id = p.turma_id
       LEFT JOIN users u ON u.id = p.confirmado_por
       LEFT JOIN recibos r ON r.pagamento_id = p.id
       LEFT JOIN LATERAL (
         SELECT l.id, l.pii_enc, l.nif FROM preinscricoes l WHERE l.pagamento_id = p.id ORDER BY l.id DESC LIMIT 1
       ) lead ON true
       LEFT JOIN LATERAL (
         SELECT d.id, d.estado, d.created_at FROM preinscricao_docs d
          WHERE lead.id IS NOT NULL AND d.preinscricao_id = lead.id AND d.tipo = 'comprovativo'
          ORDER BY d.created_at DESC LIMIT 1
       ) comp ON true
       ${w.where}
      ORDER BY COALESCE(p.pago_em, p.created_at) DESC, p.id DESC
      LIMIT 10000`,
    w.params);
}
