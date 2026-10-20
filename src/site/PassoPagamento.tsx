import { useState, type FormEvent } from "react";
import type { PagamentoPercurso } from "../partilhado/api";
import { CampoFicheiro } from "./PercursoPartes";
import { eur } from "../partilhado/ui/formatos";


/**
 * Passo de pagamento da ligação pessoal. Só aparece depois de a secretaria validar os documentos
 * e pedir o pagamento. Transferência bancária: a pessoa anexa o comprovativo e a secretaria valida.
 */
export function PassoPagamento({ nome, curso, pagamento, busy, error, ok, onEnviar }: {
  nome: string;
  curso: string;
  pagamento: PagamentoPercurso;
  busy: boolean;
  error: string;
  ok: string;
  onEnviar: (ficheiro: File) => Promise<void>;
}) {
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [substituir, setSubstituir] = useState(false);
  const comp = pagamento.comprovativo;
  const recusado = comp?.estado === "recusado";
  const aguarda = Boolean(comp) && !recusado && !substituir;

  async function submeter(e: FormEvent) {
    e.preventDefault();
    if (!ficheiro) return;
    await onEnviar(ficheiro);
    setFicheiro(null);
    setSubstituir(false);
  }

  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#e7e1d6]">
      <div className="px-6 pt-7 pb-5 sm:px-8">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c48400]">Pagamento</p>
        <h1 className="mt-2 text-[1.65rem] font-semibold tracking-tight leading-tight">{nome}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#5c564c]">
          A secretaria validou os seus documentos de {curso}. Para concluir a inscrição, faça a transferência e anexe o comprovativo.
        </p>
      </div>
      <dl className="grid gap-3 border-t border-[#efeae1] px-6 py-5 text-sm sm:grid-cols-3 sm:px-8">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8172]">Valor</dt>
          <dd className="mt-1 text-lg font-semibold">{eur(pagamento.valor, true)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8172]">IBAN</dt>
          <dd className="mt-1 break-all font-mono text-[15px]">{pagamento.iban || "A secretaria indica-lhe o IBAN por email."}</dd>
          {pagamento.titular && <dd className="mt-1 text-[#5c564c]">Titular: {pagamento.titular}</dd>}
        </div>
      </dl>
      <div className="border-t border-[#efeae1] px-6 py-5 sm:px-8">
        <p className="text-sm font-semibold">Comprovativo de pagamento</p>
        {aguarda && comp && (
          <div className="mt-2 rounded-xl bg-[#fffaf2] px-4 py-3 text-sm ring-1 ring-[#efeae1]">
            <p className="truncate text-emerald-800">{comp.nome}</p>
            <p className="mt-1 text-[#5c564c]">Recebido. Quando a secretaria confirmar o pagamento, recebe por email o acesso à área do formando.</p>
            <button type="button" className="mt-2 text-xs font-semibold underline decoration-[#ffa900] underline-offset-2" onClick={() => setSubstituir(true)}>
              Enviar outro ficheiro
            </button>
          </div>
        )}
        {recusado && (
          <p className="mt-2 text-sm text-red-800">
            A secretaria não aceitou o comprovativo{comp?.observacao ? `: ${comp.observacao}` : "."} Envie outro ficheiro.
          </p>
        )}
        {!aguarda && (
          <form onSubmit={e => void submeter(e)} className="mt-3">
            <CampoFicheiro onFile={setFicheiro} />
            <button type="submit" disabled={busy || !ficheiro} className="mt-4 w-full rounded-lg bg-[#ffa900] px-4 py-3 text-sm font-semibold text-[#1b2330] disabled:opacity-40 sm:w-auto">
              {busy ? "A anexar…" : "Anexar comprovativo"}
            </button>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        {ok && <p className="mt-3 text-sm text-emerald-800">{ok}</p>}
      </div>
    </article>
  );
}
