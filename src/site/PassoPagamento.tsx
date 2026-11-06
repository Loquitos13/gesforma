import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DadosFaturacao, PagamentoPercurso } from "../partilhado/api";
import { CampoFicheiro } from "./PercursoPartes";
import { PassoFaturacao } from "./PassoFaturacao";
import { eur } from "../partilhado/ui/formatos";


/**
 * Passo de pagamento da ligação pessoal. Só aparece depois de a secretaria validar os documentos
 * e pedir o pagamento. Transferência bancária: a pessoa anexa o comprovativo, confirma os dados de faturação
 * e a contabilidade valida o pagamento.
 */
export function PassoPagamento({ nome, curso, pagamento, busy, error, ok, onEnviar, onFaturacao, textos, soPagamento }: {
  nome: string;
  curso: string;
  pagamento: PagamentoPercurso;
  busy: boolean;
  error: string;
  ok: string;
  /** `tipo`: o comprovativo de uma prestação (comprovativo-2, …); sem ele, o 1.º. */
  onEnviar: (ficheiro: File, tipo?: string) => Promise<void>;
  /** Documentos validados (já inscrito ou a inscrever): falta só pagar as prestações seguintes. */
  soPagamento?: boolean;
  /** Grava os dados de faturação (lança o erro do servidor, para o formulário o mostrar). */
  onFaturacao: (dados: DadosFaturacao) => Promise<void>;
  /** Textos editáveis em Sistema › Site › Definições («{curso}» é o nome do curso). */
  textos?: { intro?: string; ajuda?: string; botao?: string };
}) {
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [substituir, setSubstituir] = useState(false);
  const comp = pagamento.comprovativo;
  const recusado = comp?.estado === "recusado";
  const aguarda = Boolean(comp) && !recusado && !substituir;
  const fat = pagamento.faturacao;
  // Depois do comprovativo, os dados de faturação (em destaque até estarem confirmados).
  const pedeFaturacao = Boolean(comp) && !recusado && fat != null;
  const faltaFaturacao = pedeFaturacao && !fat?.confirmado;
  const zona = useRef<HTMLDivElement>(null);
  const zonaFaturacao = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aguarda) zona.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    else if (faltaFaturacao) zonaFaturacao.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    // Ao abrir a página e quando chega um comprovativo (o passo seguinte são os dados de faturação).
  }, [comp?.id]);

  const prestacoes = pagamento.prestacoes ?? [];
  if (prestacoes.length > 1) {
    return (
      <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#e7e1d6]">
        <div className="px-6 pt-7 pb-5 sm:px-8">
          <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#c48400]">Pagamento</p>
          <h1 className="mt-2 text-[1.65rem] font-semibold tracking-tight leading-tight">{nome}</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#5c564c]">
            {soPagamento
              ? `Os seus documentos de ${curso} estão validados. O pagamento é feito em ${prestacoes.length} prestações: faça a transferência de cada uma e anexe aqui o comprovativo.`
              : (textos?.intro || "A secretaria validou os seus documentos de {curso}. Para concluir a inscrição, faça a transferência e anexe o comprovativo.").replace("{curso}", curso)}
          </p>
        </div>
        <dl className="grid gap-3 border-t border-[#efeae1] px-6 py-5 text-sm sm:grid-cols-3 sm:px-8">
          <div>
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8172]">Total</dt>
            <dd className="mt-1 text-lg font-semibold">{eur(prestacoes.reduce((a, p) => a + p.valor, 0), true)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-[#8a8172]">IBAN</dt>
            <dd className="mt-1 break-all font-mono text-[15px]">{pagamento.iban || "A secretaria indica-lhe o IBAN por email."}</dd>
            {pagamento.titular && <dd className="mt-1 text-[#5c564c]">Titular: {pagamento.titular}</dd>}
          </div>
        </dl>
        <ul className="m-0 list-none divide-y divide-[#efeae1] border-t border-[#efeae1] p-0">
          {prestacoes.map(p => <LinhaPrestacao key={p.tipo} p={p} total={prestacoes.length} busy={busy}
            proxima={p === prestacoes.find(x => x.estado === "em_falta" || x.estado === "recusado")} onEnviar={f => onEnviar(f, p.tipo)} />)}
        </ul>
        {(error || ok) && (
          <div className="border-t border-[#efeae1] px-6 py-3 sm:px-8">
            {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
            {ok && <p className="text-sm text-emerald-800">{ok}</p>}
          </div>
        )}
        {pedeFaturacao && fat && (
          <div ref={zonaFaturacao}>
            <PassoFaturacao key={`${comp?.id}:${fat.confirmado}`} dados={fat.dados} confirmado={fat.confirmado} destaque={faltaFaturacao} onGravar={onFaturacao} />
          </div>
        )}
      </article>
    );
  }

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
          {(textos?.intro || "A secretaria validou os seus documentos de {curso}. Para concluir a inscrição, faça a transferência e anexe o comprovativo.").replace("{curso}", curso)}
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
      {/* Enquanto falta o comprovativo, a zona fica em destaque e o ecrã leva lá (o botão do email abre esta página). */}
      <div ref={zona} id="comprovativo" className={`border-t border-[#efeae1] px-6 py-5 sm:px-8 ${!aguarda ? "bg-[#fff6e0] ring-2 ring-inset ring-[color:var(--lig-d,#ffa900)]" : ""}`}>
        <p className="text-sm font-semibold">Comprovativo de pagamento</p>
        {!aguarda && <p className="mt-1 text-sm text-[#5c564c]">{textos?.ajuda || "Depois de fazer a transferência, anexe aqui o comprovativo (PDF ou imagem)."}</p>}
        {aguarda && comp && (
          <div className="mt-2 rounded-xl bg-[#fffaf2] px-4 py-3 text-sm ring-1 ring-[#efeae1]">
            <p className="truncate text-emerald-800">{comp.nome}</p>
            <p className="mt-1 text-[#5c564c]">Recebido. Quando o pagamento for confirmado, recebe por email o acesso à área do formando.</p>
            <button type="button" className="mt-2 text-xs font-semibold underline decoration-[color:var(--lig-d,#ffa900)] underline-offset-2" onClick={() => setSubstituir(true)}>
              Enviar outro ficheiro
            </button>
          </div>
        )}
        {recusado && (
          <p className="mt-2 text-sm text-red-800">
            O comprovativo não foi aceite{comp?.observacao ? `: ${comp.observacao}` : "."} Envie outro ficheiro.
          </p>
        )}
        {!aguarda && (
          <form onSubmit={e => void submeter(e)} className="mt-3">
            <CampoFicheiro onFile={setFicheiro} />
            <button type="submit" disabled={busy || !ficheiro} className="mt-4 w-full rounded-lg bg-[color:var(--lig-d,#ffa900)] px-4 py-3 text-sm font-semibold text-[#1b2330] disabled:opacity-40 sm:w-auto">
              {busy ? "A anexar…" : textos?.botao || "Anexar comprovativo"}
            </button>
          </form>
        )}
        {error && <p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
        {ok && <p className="mt-3 text-sm text-emerald-800">{ok}</p>}
      </div>
      {pedeFaturacao && fat && (
        <div ref={zonaFaturacao}>
          <PassoFaturacao key={`${comp?.id}:${fat.confirmado}`} dados={fat.dados} confirmado={fat.confirmado} destaque={faltaFaturacao} onGravar={onFaturacao} />
        </div>
      )}
    </article>
  );
}

/** Uma prestação: paga, à espera de validação, recusada ou por pagar (a próxima fica em destaque, com o envio). */
function LinhaPrestacao({ p, total, proxima, busy, onEnviar }: {
  p: NonNullable<PagamentoPercurso["prestacoes"]>[number]; total: number; proxima: boolean; busy: boolean; onEnviar: (f: File) => Promise<void>;
}) {
  const [ficheiro, setFicheiro] = useState<File | null>(null);
  const [aberto, setAberto] = useState(false);
  const podeEnviar = p.estado === "em_falta" || p.estado === "recusado" || aberto;
  const estado = { validado: "Paga", pendente: "Recebido · a aguardar validação", recusado: "Comprovativo não aceite", em_falta: "Por pagar" }[p.estado];
  return (
    <li className={`px-6 py-4 sm:px-8 ${proxima ? "bg-[#fff6e0] ring-2 ring-inset ring-[color:var(--lig-d,#ffa900)]" : ""}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{p.n}.ª prestação de {total} · {eur(p.valor, true)}</p>
        <p className={`text-xs font-semibold ${p.estado === "validado" ? "text-emerald-800" : p.estado === "recusado" ? "text-red-800" : "text-[#8a8172]"}`}>{estado}</p>
      </div>
      {p.estado === "recusado" && p.observacao && <p className="mt-1 text-sm text-red-800">{p.observacao}</p>}
      {p.estado === "pendente" && !aberto && (
        <button type="button" className="mt-1 text-xs font-semibold underline decoration-[color:var(--lig-d,#ffa900)] underline-offset-2" onClick={() => setAberto(true)}>
          Enviar outro ficheiro
        </button>
      )}
      {podeEnviar && p.estado !== "validado" && (
        <form className="mt-3" onSubmit={e => { e.preventDefault(); if (ficheiro) void onEnviar(ficheiro).then(() => { setFicheiro(null); setAberto(false); }); }}>
          <CampoFicheiro onFile={setFicheiro} />
          <button type="submit" disabled={busy || !ficheiro} className="mt-3 w-full rounded-lg bg-[color:var(--lig-d,#ffa900)] px-4 py-2.5 text-sm font-semibold text-[#1b2330] disabled:opacity-40 sm:w-auto">
            {busy ? "A anexar…" : "Anexar comprovativo"}
          </button>
        </form>
      )}
    </li>
  );
}
