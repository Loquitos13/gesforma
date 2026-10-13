import { useState } from "react";
import { apiCrmPedirPagamento, type CrmDossier } from "../partilhado/api";
import { persist, toastOk } from "../partilhado/toastBus";
import { fmtDataCalendario } from "./datas";

/**
 * Pagamento da pré-inscrição Gold, na validação da ficha CRM.
 * A secretaria pede o pagamento depois de validar os documentos; a pessoa recebe o email e o passo
 * de pagamento abre na ligação pessoal. Com o pagamento confirmado (comprovativo validado), a
 * pré-inscrição valida-se e a ficha de formando e a conta são criadas sozinhas.
 */
export function PagamentoPreinscricao({ leadId, dossier, podeAgir, onDossier }: {
  leadId: number;
  dossier: CrmDossier;
  podeAgir: boolean;
  onDossier: (d: CrmDossier) => void;
}) {
  const [busy, setBusy] = useState(false);
  const estado = dossier.estadoPagamento ?? "isento";
  if (estado === "isento") return null;
  const valor = dossier.pagamento?.valor ?? dossier.lead.preco ?? 0;

  async function pedir() {
    setBusy(true);
    const r = await persist(apiCrmPedirPagamento(leadId));
    setBusy(false);
    if (!r) return;
    onDossier(r);
    toastOk(r.pedido?.semIban
      ? "Pagamento pedido. Atenção: falta o IBAN em Configurações → Entidade formadora, o email não o indica."
      : "Pagamento pedido. A pessoa recebeu o email com o IBAN e a ligação para o comprovativo.");
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-amber-800">Pagamento · € {Number(valor).toLocaleString("pt-PT")}</p>
      {estado === "por_pedir" && (
        <p className="text-sm text-slate-700">
          {dossier.podePedirPagamento
            ? "Documentos validados. Peça o pagamento: a pessoa recebe o email e o passo de pagamento abre na ligação pessoal."
            : dossier.faltaPedirPagamento || "Valide os documentos antes de pedir o pagamento."}
        </p>
      )}
      {estado === "pedido" && (
        <p className="text-sm text-slate-700">
          Pedido {dossier.pagamentoPedidoEm ? `em ${fmtDataCalendario(dossier.pagamentoPedidoEm.slice(0, 10))}` : ""}. Aguarda o comprovativo de transferência.
          Ao validar o comprovativo, a inscrição conclui-se: ficha de formando, conta e email de acesso.
        </p>
      )}
      {estado === "pago" && <p className="text-sm text-emerald-800">Pagamento confirmado.</p>}
      {podeAgir && (estado === "por_pedir" || estado === "pedido") && (
        <button
          type="button"
          disabled={busy || !dossier.podePedirPagamento}
          onClick={() => void pedir()}
          className="w-full py-2 bg-amber-500 disabled:opacity-40 text-white text-sm font-bold rounded-lg"
        >
          {busy ? "A enviar…" : estado === "pedido" ? "Reenviar pedido de pagamento" : "Pedir pagamento"}
        </button>
      )}
    </div>
  );
}
