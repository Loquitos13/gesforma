import { useEffect } from "react";
import { usePode } from "../partilhado/AuthGate";
import { apiGerarAcessoFormando } from "../partilhado/api";
import { toastError, toastOk } from "../partilhado/toastBus";
import { OptionSelect } from "./OptionSelect";

/**
 * Ficha de formando criada à mão pela secretaria (sem pré-inscrição): oferta, pagamento
 * combinado à parte, etc. O acesso à área do formando usa o email registado e uma palavra-passe
 * temporária, enviada por email se a secretaria quiser.
 */

export type OpcoesManual = {
  pagamento: "oferta" | "pago" | "por_pagar";
  metodo: string;
  criarAcesso: boolean;
};

export const OPCOES_MANUAL: OpcoesManual = { pagamento: "por_pagar", metodo: "", criarAcesso: true };

export function emailValido(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Campos de pagamento da ficha Gold. O valor da oferta é 0; nos outros casos vem do preço do curso. */
export function pagamentoDaFicha(op: OpcoesManual) {
  if (op.pagamento === "oferta") return { pago: true, valor: 0, metodo: "Oferta" };
  if (op.pagamento === "pago") return { pago: true, valor: 0, metodo: op.metodo || "-" };
  return { pago: false, valor: 0, metodo: "-" };
}

export function CamposInscricaoManual({ value, onChange, regime }: {
  value: OpcoesManual;
  onChange: (v: OpcoesManual) => void;
  regime: "gold" | "fin";
}) {
  const lbl = "text-xs font-semibold text-slate-500 uppercase tracking-wide";
  // Gerar o acesso mostra a palavra-passe: só a secretaria (Gold) e a pedagogia (Financiada), como no servidor.
  const pode = usePode();
  const podeAcesso = pode(regime === "fin" ? "formandosFin.gerir" : "pagamentos.confirmar");
  useEffect(() => {
    if (!podeAcesso && value.criarAcesso) onChange({ ...value, criarAcesso: false });
  }, [podeAcesso, value, onChange]);
  return (
    <div className="space-y-3">
      {regime === "gold" && (
        <label className="flex flex-col gap-1.5">
          <span className={lbl}>Pagamento</span>
          <select
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-700"
            value={value.pagamento}
            onChange={e => onChange({ ...value, pagamento: e.target.value as OpcoesManual["pagamento"] })}
          >
            <option value="por_pagar">Por pagar (preço do curso)</option>
            <option value="pago">Já pago</option>
            <option value="oferta">Oferta (sem pagamento)</option>
          </select>
        </label>
      )}
      {regime === "gold" && value.pagamento === "pago" && (
        <OptionSelect lista="metodos_pagamento" value={value.metodo} onChange={m => onChange({ ...value, metodo: m })} allowEmpty placeholder="Método de pagamento" />
      )}
      {podeAcesso && (
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4" checked={value.criarAcesso} onChange={e => onChange({ ...value, criarAcesso: e.target.checked })} />
          <span>Criar o acesso à área do formando e enviar por email (utilizador: o email; palavra-passe temporária).</span>
        </label>
      )}
    </div>
  );
}

/** Gera o acesso de uma ficha acabada de criar e envia-o por email. */
export async function darAcessoManual(regime: "gold" | "fin", id: number) {
  try {
    const r = await apiGerarAcessoFormando(regime, id, false, true);
    toastOk(r.acesso.emailEnviado
      ? `Acesso enviado para ${r.acesso.email}.`
      : `Acesso criado para ${r.acesso.email}, mas o email não saiu. Use «Gerar nova palavra-passe» na ficha.`);
  } catch (err) {
    toastError(err, "Ficha criada, mas o acesso não foi gerado.");
  }
}
