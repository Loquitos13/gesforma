import { garantirToken } from "./ligacaoPessoal.js";
import { enviarModelo } from "./emailModelo.js";
import { config } from "./config.js";
import { carimboUtc } from "./datas.js";
import { getLeadDossier, logLeadEvent } from "./crmDossier.js";
import { lerEntidade } from "./regrasConfig.js";
import type { Db } from "./db/pool.js";
import { confirmarPagamento, nextOpsId } from "./ops.js";
import { precoParaOferta } from "./precoOferta.js";
import { isEmail, normalizeEmail } from "./security.js";
import * as leads from "./repos/leads.js";
import * as pags from "./repos/pagamentosLead.js";

/** Método do pagamento pedido pela secretaria: transferência bancária com comprovativo. */
const TRANSFERENCIA = "Transferência bancária";

function documentosUrl(token: string) {
  return `${config.appOrigin.replace(/\/$/, "")}/documentos/${token}`;
}

async function alinharPrecoLead(
  db: Db,
  lead: { id: number; curso: string; local?: string; horario?: string; preco: number },
) {
  if (!lead.curso) return lead.preco;
  const resolved = await precoParaOferta(db, lead.curso, lead.local ?? "", lead.horario ?? "");
  if (resolved == null) return lead.preco;
  if (resolved !== Number(lead.preco)) await pags.alinharPreco(db, lead.id, resolved);
  return resolved;
}

/** Cancelado ou reembolsado: conta como inexistente (não volta a «Pago»; cria-se outro). */
function anulado(row: Record<string, unknown>) {
  return ["Cancelado", "Reembolsado"].includes(String(row.estado ?? ""));
}

/** Garante um pagamento pendente com o valor actual. Sem referências Multibanco. */
export async function ensurePagamentoPendente(
  db: Db,
  lead: { id: number; nome: string; apelido: string; email: string; curso: string; local?: string; horario?: string; preco: number; pagamento_id?: string | null },
) {
  lead.preco = await alinharPrecoLead(db, lead);
  const alinhar = async (row: Record<string, unknown>) => {
    if (String(row.estado ?? "") === "Pendente" && Number(row.valor) !== lead.preco) {
      await pags.actualizarValorPendente(db, String(row.id), lead.preco);
      row.valor = lead.preco;
    }
    return row;
  };
  let substituir = false;
  if (lead.pagamento_id) {
    const row = await pags.pagamento(db, String(lead.pagamento_id));
    if (row && !anulado(row)) return alinhar(row);
    substituir = Boolean(row);
  }
  const email = normalizeEmail(lead.email);
  const existente = await pags.pendenteDoEmailCurso(db, email, lead.curso);
  if (existente) {
    await alinhar(existente);
    await pags.ligarAoLead(db, lead.id, String(existente.id), !substituir);
    return existente;
  }
  const id = String(await nextOpsId(db));
  const valor = Number(lead.preco) || 0;
  await pags.criarPagamento(db, {
    id, nome: `${lead.nome} ${lead.apelido}`.trim(), valor, metodo: TRANSFERENCIA, curso: lead.curso, data: carimboUtc(), email,
  });
  await pags.ligarAoLead(db, lead.id, id);
  return (await pags.pagamento(db, id)) ?? { id, valor, estado: "Pendente" };
}

export class PedidoPagamentoErro extends Error {}

function fmtEuros(v: number) {
  return v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * A secretaria pede o pagamento depois de validar os documentos (Gold com preço).
 * Abre o passo de pagamento na ligação pessoal e envia o email com o valor, o IBAN e a ligação.
 * Pode repetir-se (reenviar) enquanto o pagamento não estiver confirmado.
 */
export async function pedirPagamento(db: Db, leadId: number, actorId?: string) {
  const dossier = await getLeadDossier(db, leadId);
  if (!dossier) throw new PedidoPagamentoErro("Pré-inscrição inexistente.");
  if (!dossier.podePedirPagamento) throw new PedidoPagamentoErro(dossier.faltaPedirPagamento || "Ainda não é possível pedir o pagamento.");
  const row = await leads.lead(db, leadId);
  const lead = row as unknown as {
    id: number; nome: string; apelido: string; email: string; curso: string; local: string;
    preco: number; horario: string; pagamento_id: string | null;
  };
  const email = normalizeEmail(lead.email);
  if (!isEmail(email)) throw new PedidoPagamentoErro("A pré-inscrição não tem um email válido.");
  const pag = await ensurePagamentoPendente(db, { ...lead, preco: Number(lead.preco) || 0 });
  await pags.definirMetodoPendente(db, String(pag.id), TRANSFERENCIA);
  await pags.marcarPagamentoPedido(db, leadId);

  const valor = Number(pag.valor ?? lead.preco) || 0;
  const ent = await lerEntidade(db);
  const iban = ent.iban.replace(/(.{4})/g, "$1 ").trim();
  const url = `${documentosUrl(await garantirToken(db, leadId))}?passo=pagamento`;
  const nome = `${lead.nome} ${lead.apelido}`.trim();
  // Sem o IBAN no email: o botão abre a página de pagamento, com os dados da transferência e o campo do comprovativo.
  await enviarModelo(db, {
    tipo: "pedido_pagamento", para: email, nome, link: url,
    vars: { curso: lead.curso, valor: fmtEuros(valor), documentos_url: url, comprovativo_url: url },
    reserva: {
      assunto: "Pagamento da inscrição em {{curso}}",
      linhas: [
        "A secretaria validou os seus documentos de {{curso}}.",
        "Para concluir a inscrição, falta o pagamento de € {{valor}} por transferência bancária.",
        "Clique no botão para abrir a sua página de pagamento: aí encontra os dados para a transferência e o campo para anexar o comprovativo.",
        "Assim que o pagamento for confirmado, recebe por email o acesso à área do formando.",
      ],
      cta: "Pagar e anexar o comprovativo",
    },
  });
  const nota = `Pagamento pedido · € ${fmtEuros(valor)} por transferência${iban ? ` para ${iban}` : ""}.`;
  await leads.inserirContacto(db, { leadId, actorId, nota, meio: "Email" });
  await logLeadEvent(db, leadId, actorId, "seguimento", "Pagamento pedido", nota);
  return { ok: true as const, valor, iban, semIban: !iban };
}

/**
 * A secretaria marca a pré-inscrição como paga: confirma o pagamento ligado ou, se não existir,
 * regista-o na hora (para a tesouraria ter o movimento). O email de confirmação sai uma só vez.
 */
export async function marcarLeadPago(db: Db, leadId: number) {
  const lead = await leads.lead(db, leadId);
  if (!lead) return null;
  let pag = lead.pagamento_id ? await pags.pagamento(db, String(lead.pagamento_id)) : null;
  if (!pag || anulado(pag)) {
    const id = `TRX-${await nextOpsId(db)}`;
    await pags.criarPagamento(db, {
      id,
      nome: `${lead.nome ?? ""} ${lead.apelido ?? ""}`.trim(),
      valor: Number(lead.preco) || 0,
      metodo: String(lead.pagamento_metodo ?? "") || "Manual",
      curso: String(lead.curso ?? ""),
      data: carimboUtc(),
      email: normalizeEmail(String(lead.email ?? "")),
    });
    await pags.ligarAoLead(db, leadId, id);
    pag = await pags.pagamento(db, id);
  }
  if (!pag) return null;
  if (!/^pago$/i.test(String(pag.estado ?? ""))) await confirmarPagamento(db, pag, null, { soPendente: true });
  await pags.marcarLeadPago(db, leadId);
  return { pagamentoId: String(pag.id) };
}
