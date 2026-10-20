import { ingestEvent } from "./automations.js";
import { config } from "./config.js";
import { carimboUtc } from "./datas.js";
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

/**
 * Marca o pagamento como Pago, dispara o email e actualiza a ficha Gold e a pré-inscrição ligadas.
 * Se o pagamento foi pedido no percurso da pré-inscrição, conclui a inscrição (ficha, conta e acesso).
 */
export async function confirmarPagamento(db: Db, row: Record<string, unknown>, actorId?: string | null, opts: { soPendente?: boolean } = {}) {
  const mapped = mapPagamento(row);
  const email = mapped.email ? normalizeEmail(mapped.email) : "";
  const comEmail = Boolean(email && isEmail(email));
  const formandoId = row.formando_id == null ? null : Number(row.formando_id);
  // Estado, ficha Gold e pré-inscrição mudam juntos ou não mudam: uma falha a meio não deixa o pagamento Pago
  // com a ficha por pagar (e a reentrega do webhook, que vê Pago, já não os repetia).
  // Dois pedidos ao mesmo tempo: só o que muda o estado dispara os efeitos.
  const mudou = await db.tx(async q => {
    if (!(await marcarPago(q, mapped.id, carimboUtc(), actorId, opts.soPendente))) return false;
    // A ficha ligada fica paga mesmo sem email; sem ficha ligada, procura-se pelo email e curso.
    if (formandoId != null || comEmail) {
      await marcarFormandoGoldPago(q, { email, metodo: mapped.metodo || METODOS_ACEITES[0], formandoId, curso: mapped.curso });
    }
    if (comEmail) await marcarLeadPago(q, { email, pagamentoId: mapped.id, curso: mapped.curso });
    return true;
  });
  if (!mudou) {
    const atual = await obterPagamento(db, mapped.id);
    return atual ? mapPagamento(atual) : mapped;
  }
  // Depois de gravado: emails e conclusão da inscrição (ambos seguros de repetir).
  const { aposPagamentoConfirmado, leadDoPagamentoPedido } = await import("./inscricaoPaga.js");
  const doPercurso = await leadDoPagamentoPedido(db, mapped.id);
  if (comEmail && !doPercurso) {
    await ingestEvent(db, "payment.confirmed", { email, nome: mapped.nome, curso: mapped.curso, pagamentoId: mapped.id }, `payment:${mapped.id}:${email}`)
      .catch(() => undefined);
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
