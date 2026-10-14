import { ingestEvent } from "./automations.js";
import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { sendMail } from "./mailer.js";
import {
  mapPagamento, marcarFormandoGoldPago, marcarLeadPago, marcarPago, obterPagamento, pagamentosPorReferencia, registarRecusa,
} from "./repos/pagamentos.js";
import { isEmail, normalizeEmail } from "./security.js";

/**
 * Regras de negócio dos pagamentos: confirmar (comprovativo, webhook ou secretaria) e recusar.
 * O SQL está em repos/pagamentos.ts.
 */

export { mapPagamento };

/** Métodos aceites hoje (sem gateway). O primeiro é o de omissão. */
export const METODOS_ACEITES = ["Transferência bancária", "Numerário", "Oferta"] as const;

function carimbo() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

/**
 * Marca o pagamento como Pago, dispara o email e actualiza a ficha Gold e a pré-inscrição ligadas.
 * Se o pagamento foi pedido no percurso da pré-inscrição, conclui a inscrição (ficha, conta e acesso).
 */
export async function confirmarPagamento(db: Db, row: Record<string, unknown>, actorId?: string | null) {
  const mapped = mapPagamento(row);
  if (!/^pago$/i.test(mapped.estado)) await marcarPago(db, mapped.id, carimbo(), actorId);
  const email = mapped.email ? normalizeEmail(mapped.email) : "";
  const { aposPagamentoConfirmado, leadDoPagamentoPedido } = await import("./inscricaoPaga.js");
  const doPercurso = await leadDoPagamentoPedido(db, mapped.id);
  if (email && isEmail(email)) {
    if (!doPercurso) {
      await ingestEvent(db, "payment.confirmed", { email, nome: mapped.nome, curso: mapped.curso }, `payment:${mapped.id}:${email}`)
        .catch(() => undefined);
    }
    const formandoId = row.formando_id == null ? null : Number(row.formando_id);
    await marcarFormandoGoldPago(db, { email, metodo: mapped.metodo || METODOS_ACEITES[0], formandoId, curso: mapped.curso });
    await marcarLeadPago(db, { email, pagamentoId: mapped.id, curso: mapped.curso });
  }
  if (doPercurso) await aposPagamentoConfirmado(db, mapped.id);
  const depois = await obterPagamento(db, mapped.id);
  return depois ? mapPagamento(depois) : mapped;
}

export class PagamentoErro extends Error {}

/**
 * Recusa o comprovativo: o pagamento continua por receber, o comprovativo fica recusado
 * e a pessoa recebe um email com o motivo e a ligação para anexar outro.
 */
export async function recusarPagamento(db: Db, id: string, motivo: string) {
  const row = await obterPagamento(db, id);
  if (!row) throw new PagamentoErro("Pagamento inexistente.");
  if (String(row.estado) !== "Pendente") throw new PagamentoErro("Só se recusa um pagamento que ainda está por receber.");
  await registarRecusa(db, id, motivo);
  const mapped = mapPagamento(row);
  const email = normalizeEmail(mapped.email);
  let avisado = false;
  if (isEmail(email)) {
    const href = await ligacaoParaPagamento(db, id);
    const linhas = [
      `Não conseguimos confirmar o comprovativo de pagamento de ${mapped.curso || "a sua inscrição"}.`,
      `Motivo: ${motivo}`,
      href
        ? "Pode anexar um novo comprovativo na sua ligação pessoal, no passo «Pagamento»."
        : "Responda a este email com um novo comprovativo e a secretaria trata do resto.",
    ];
    const mail = renderAutomaticEmail({
      nome: mapped.nome, xml: "", linhas, cta: href ? "Anexar novo comprovativo" : "", href: href ?? "",
      vars: { nome: mapped.nome, curso: mapped.curso }, origin: config.appOrigin,
    });
    await sendMail(db, { to: email, name: mapped.nome, subject: `Comprovativo de pagamento · ${mapped.curso}`.trim(), text: mail.text, html: mail.html });
    avisado = true;
  }
  return { pagamento: mapPagamento((await obterPagamento(db, id)) ?? row), avisado };
}

/** Ligação pessoal (passo de pagamento) da pré-inscrição ligada ao pagamento, se houver. */
async function ligacaoParaPagamento(db: Db, pagamentoId: string) {
  const { leadDoPagamentoPedido } = await import("./inscricaoPaga.js");
  const leadId = await leadDoPagamentoPedido(db, pagamentoId);
  if (!leadId) return null;
  const { garantirToken } = await import("./ligacaoPessoal.js");
  const token = await garantirToken(db, leadId);
  return `${config.appOrigin.replace(/\/$/, "")}/documentos/${token}?passo=pagamento`;
}

/** Pagamento pela referência (webhook). Com valor, escolhe o que coincide. */
export async function findPagamentoPorReferencia(db: Db, referencia: string, valor?: number) {
  const digitos = referencia.replace(/\D/g, "");
  if (!digitos) return null;
  const lista = await pagamentosPorReferencia(db, referencia, digitos);
  if (valor == null || !Number.isFinite(valor)) return lista[0] ?? null;
  return lista.find(r => Math.abs(Number(r.valor) - valor) < 0.02) ?? null;
}
