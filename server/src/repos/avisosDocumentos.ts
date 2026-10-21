/**
 * Avisos dos documentos: recusas por avisar (pré-inscrições e formandos da Financiada) e o ciclo de lembretes
 * automáticos dos documentos do dossiê da Financiada.
 */
import { many, one, type Consulta } from "./sql.js";

const ABERTA = "p.validada_em IS NULL AND p.estado NOT IN ('Desistiu', 'Formando')";
const FIN_FECHADO = `(lower(COALESCE(f.estado, '')) LIKE 'desist%' OR lower(COALESCE(f.estado, '')) IN ('indeferido', 'concluído', 'concluido', 'certificado')
  OR t.fechada_em IS NOT NULL)`;

/* ── Pré-inscrições ──────────────────────────────────────────────────────── */

/** Ids dos documentos recusados que ainda não seguiram num email. */
export async function recusasPorAvisarLead(c: Consulta, leadId: number) {
  return (await many<{ id: number }>(c,
    "SELECT id FROM preinscricao_docs WHERE preinscricao_id = $1 AND estado = 'recusado' AND recusa_avisada_em IS NULL",
    [leadId])).map(r => Number(r.id));
}

/**
 * Reserva o email da recusa (um de cada vez por pré-inscrição): falha se outro saiu há menos de `janelaS` segundos,
 * a não ser com `forcar` (pedido explícito da secretaria). Devolve a data anterior para se poder desfazer.
 */
export async function reclamarEmailRecusaLead(c: Consulta, leadId: number, janelaS: number, forcar: boolean) {
  return one<{ anterior: string | Date | null }>(c,
    `UPDATE preinscricoes p SET recusa_email_em = now()
       FROM (SELECT id, recusa_email_em AS anterior FROM preinscricoes WHERE id = $1 FOR UPDATE) a
      WHERE p.id = a.id
        AND ($3::boolean OR p.recusa_email_em IS NULL OR p.recusa_email_em <= now() - $2::int * interval '1 second')
      RETURNING a.anterior`,
    [leadId, janelaS, forcar]);
}

export async function libertarEmailRecusaLead(c: Consulta, leadId: number, anterior: string | Date | null) {
  await many(c, "UPDATE preinscricoes SET recusa_email_em = $2 WHERE id = $1", [leadId, anterior]);
}

export async function marcarRecusasAvisadasLead(c: Consulta, leadId: number, ids: number[]) {
  if (!ids.length) return;
  await many(c,
    "UPDATE preinscricao_docs SET recusa_avisada_em = now() WHERE preinscricao_id = $1 AND id = ANY($2::int[]) AND estado = 'recusado'",
    [leadId, `{${ids.join(",")}}`]);
}

/** Pedido novo (recusa avisada): os lembretes recomeçam a contar a partir de agora. */
export async function reiniciarLembretesLead(c: Consulta, leadId: number) {
  await many(c,
    "UPDATE preinscricoes SET lembrete_pre_em = now(), lembretes_enviados = 0, ultimo_lembrete_em = NULL WHERE id = $1",
    [leadId]);
}

/** O pedido foi reenviado à mão: o próximo lembrete conta a partir de agora. */
export async function adiarLembreteLead(c: Consulta, leadId: number) {
  await many(c, "UPDATE preinscricoes SET lembrete_pre_em = now() WHERE id = $1", [leadId]);
}

/** Pré-inscrições abertas com recusas por avisar, fora da janela de agrupamento. */
export async function leadsComRecusasPorAvisar(c: Consulta, janelaS: number, limite: number, excluir: number[]) {
  return (await many<{ id: number }>(c,
    `SELECT p.id FROM preinscricoes p
      WHERE ${ABERTA}
        AND (p.recusa_email_em IS NULL OR p.recusa_email_em <= now() - $1::int * interval '1 second')
        AND NOT (p.id = ANY($3::int[]))
        AND EXISTS (SELECT 1 FROM preinscricao_docs d
                     WHERE d.preinscricao_id = p.id AND d.estado = 'recusado' AND d.recusa_avisada_em IS NULL)
      ORDER BY p.id
      LIMIT $2`,
    [janelaS, limite, `{${excluir.join(",")}}`])).map(r => Number(r.id));
}

/* ── Formandos da Financiada ─────────────────────────────────────────────── */

export async function recusasPorAvisarFin(c: Consulta, formandoId: number) {
  return (await many<{ doc_id: string }>(c,
    "SELECT doc_id FROM formando_docs WHERE regime = 'fin' AND formando_id = $1 AND estado = 'recusado' AND recusa_avisada_em IS NULL",
    [formandoId])).map(r => r.doc_id);
}

export async function reclamarEmailRecusaFin(c: Consulta, formandoId: number, janelaS: number, forcar: boolean) {
  return one<{ anterior: string | Date | null }>(c,
    `UPDATE formandos_fin f SET recusa_email_em = now()
       FROM (SELECT id, recusa_email_em AS anterior FROM formandos_fin WHERE id = $1 FOR UPDATE) a
      WHERE f.id = a.id
        AND ($3::boolean OR f.recusa_email_em IS NULL OR f.recusa_email_em <= now() - $2::int * interval '1 second')
      RETURNING a.anterior`,
    [formandoId, janelaS, forcar]);
}

export async function libertarEmailRecusaFin(c: Consulta, formandoId: number, anterior: string | Date | null) {
  await many(c, "UPDATE formandos_fin SET recusa_email_em = $2 WHERE id = $1", [formandoId, anterior]);
}

export async function marcarRecusasAvisadasFin(c: Consulta, formandoId: number, docIds: string[]) {
  if (!docIds.length) return;
  await many(c,
    `UPDATE formando_docs SET recusa_avisada_em = now()
      WHERE regime = 'fin' AND formando_id = $1 AND doc_id = ANY($2::text[]) AND estado = 'recusado'`,
    [formandoId, docIds]);
}

/** Entra (ou volta a entrar) no ciclo de lembretes: o primeiro sai depois do intervalo configurado. */
export async function iniciarCicloFin(c: Consulta, formandoId: number, reiniciar = false) {
  await many(c,
    reiniciar
      ? "UPDATE formandos_fin SET lembrete_docs_em = now(), lembretes_docs_enviados = 0 WHERE id = $1"
      : "UPDATE formandos_fin SET lembrete_docs_em = now() WHERE id = $1",
    [formandoId]);
}

export async function pararCicloFin(c: Consulta, formandoId: number) {
  await many(c, "UPDATE formandos_fin SET lembrete_docs_em = NULL WHERE id = $1", [formandoId]);
}

export async function adiarCicloFin(c: Consulta, formandoId: number) {
  await many(c, "UPDATE formandos_fin SET lembrete_docs_em = now() WHERE id = $1 AND lembrete_docs_em IS NOT NULL", [formandoId]);
}

export async function formandosFinComRecusasPorAvisar(c: Consulta, janelaS: number, limite: number, excluir: number[]) {
  return (await many<{ id: number }>(c,
    `SELECT f.id FROM formandos_fin f LEFT JOIN turmas_fin t ON t.id = f.turma_id
      WHERE NOT ${FIN_FECHADO}
        AND (f.recusa_email_em IS NULL OR f.recusa_email_em <= now() - $1::int * interval '1 second')
        AND NOT (f.id = ANY($3::int[]))
        AND EXISTS (SELECT 1 FROM formando_docs d
                     WHERE d.regime = 'fin' AND d.formando_id = f.id AND d.estado = 'recusado' AND d.recusa_avisada_em IS NULL)
      ORDER BY f.id
      LIMIT $2`,
    [janelaS, limite, `{${excluir.join(",")}}`])).map(r => Number(r.id));
}

/** Formandos no ciclo de lembretes cujo lembrete venceu, abaixo do máximo. Os fechados saem do ciclo. */
export async function formandosFinDevidos(c: Consulta, limite: Date, maximo: number, lote: number) {
  await many(c,
    `UPDATE formandos_fin f SET lembrete_docs_em = NULL
       FROM formandos_fin x LEFT JOIN turmas_fin t ON t.id = x.turma_id
      WHERE f.id = x.id AND f.lembrete_docs_em IS NOT NULL AND ${FIN_FECHADO.replace(/\bf\./g, "x.")}`);
  return many<{ id: number }>(c,
    `SELECT id FROM formandos_fin
      WHERE lembrete_docs_em IS NOT NULL AND lembrete_docs_em <= $1
        AND lembretes_docs_enviados < $2
        AND btrim(COALESCE(email, '')) <> ''
      ORDER BY lembrete_docs_em
      LIMIT $3`,
    [limite, maximo, lote]);
}

/** Reserva o lembrete (dois processos não enviam o mesmo). */
export async function reclamarLembreteFin(c: Consulta, formandoId: number, limite: Date) {
  return Boolean(await one(c,
    `UPDATE formandos_fin SET lembrete_docs_em = now(), lembretes_docs_enviados = lembretes_docs_enviados + 1, lembrete_docs_enviado_em = now()
      WHERE id = $1 AND lembrete_docs_em IS NOT NULL AND lembrete_docs_em <= $2 RETURNING id`,
    [formandoId, limite]));
}

export async function cicloFin(c: Consulta, formandoId: number) {
  return one<{ lembrete_docs_em: string | Date | null; lembretes_docs_enviados: number; lembrete_docs_enviado_em: string | Date | null }>(c,
    "SELECT lembrete_docs_em, lembretes_docs_enviados, lembrete_docs_enviado_em FROM formandos_fin WHERE id = $1", [formandoId]);
}
