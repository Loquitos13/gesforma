import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Botao } from "./Botao";
import { Selecao, type OpcaoSelecao } from "./Campo";
import { cx } from "./formatos";

type Valores = Record<string, string>;

function lerUrl<T extends Valores>(padrao: T): T {
  const q = new URLSearchParams(window.location.search);
  const out = { ...padrao };
  for (const k of Object.keys(padrao)) {
    const v = q.get(k);
    if (v != null) (out as Valores)[k] = v;
  }
  return out;
}

function escreverUrl(valores: Valores, padrao: Valores) {
  const q = new URLSearchParams(window.location.search);
  for (const k of Object.keys(padrao)) {
    const v = valores[k] ?? "";
    if (v === "" || v === padrao[k]) q.delete(k);
    else q.set(k, v);
  }
  const s = q.toString();
  const url = `${window.location.pathname}${s ? `?${s}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", url);
  // Outros ecrãs/hooks na mesma página que leem as mesmas chaves acompanham a mudança.
  queueMicrotask(() => window.dispatchEvent(new Event(EVENTO_FILTROS)));
}

const EVENTO_FILTROS = "gesforma:filtros";

/**
 * Estado de filtros guardado na query do URL (partilhável, sobrevive a F5).
 * Só mexe nas chaves de `padrao`; valores iguais ao padrão não aparecem no URL.
 *
 *   const [f, setF, limpar] = useFiltrosUrl({ q: "", curso: "", estado: "abertas", pagina: "1" });
 */
export function useFiltrosUrl<T extends Valores>(padrao: T): [T, (patch: Partial<T>) => void, () => void] {
  const padraoRef = useRef(padrao);
  const [valores, setValores] = useState<T>(() => lerUrl(padrao));

  useEffect(() => {
    const voltar = () => {
      const lido = lerUrl(padraoRef.current);
      setValores(prev => (JSON.stringify(prev) === JSON.stringify(lido) ? prev : lido));
    };
    window.addEventListener("popstate", voltar);
    window.addEventListener(EVENTO_FILTROS, voltar);
    return () => {
      window.removeEventListener("popstate", voltar);
      window.removeEventListener(EVENTO_FILTROS, voltar);
    };
  }, []);

  const set = useCallback((patch: Partial<T>) => {
    setValores(prev => {
      // Mudar um filtro volta à primeira página.
      const mudaPagina = "pagina" in padraoRef.current && !("pagina" in patch);
      const novo = { ...prev, ...patch, ...(mudaPagina ? { pagina: padraoRef.current.pagina } : {}) } as T;
      escreverUrl(novo, padraoRef.current);
      return novo;
    });
  }, []);

  const limpar = useCallback(() => {
    escreverUrl(padraoRef.current, padraoRef.current);
    setValores({ ...padraoRef.current });
  }, []);

  return [valores, set, limpar];
}

export type FiltroSelecao = {
  chave: string;
  rotulo: string;
  opcoes: OpcaoSelecao[];
  valor: string;
  onMudar: (v: string) => void;
  /** Texto da opção "todos" (ex.: "Todos os cursos"). */
  vazio?: string;
};

/**
 * Barra de filtros: pesquisa (com espera de 250 ms), selects e período.
 * `ativos` conta os filtros aplicados e mostra "Limpar filtros".
 */
export function Filtros({
  pesquisa, selecoes = [], periodo, ativos = 0, onLimpar, extra, className, moldura = true,
}: {
  pesquisa?: { valor: string; onMudar: (v: string) => void; placeholder?: string; rotulo?: string };
  selecoes?: FiltroSelecao[];
  periodo?: { de: string; ate: string; onMudar: (de: string, ate: string) => void };
  ativos?: number;
  onLimpar?: () => void;
  extra?: ReactNode;
  className?: string;
  /** Sem moldura quando a barra vive dentro de um cartão (ex.: cabeçalho de uma tabela). */
  moldura?: boolean;
}) {
  const [texto, setTexto] = useState(pesquisa?.valor ?? "");
  const espera = useRef<number | null>(null);
  useEffect(() => { setTexto(pesquisa?.valor ?? ""); }, [pesquisa?.valor]);

  function escrever(v: string) {
    setTexto(v);
    if (espera.current) window.clearTimeout(espera.current);
    espera.current = window.setTimeout(() => pesquisa?.onMudar(v), 250);
  }

  return (
    <div className={cx("flex flex-wrap items-center gap-2", moldura && "bg-superficie border border-linha rounded-cartao px-3 py-2.5", className)}>
      {pesquisa && (
        <label className="flex items-center gap-2 h-9 px-2.5 rounded-controlo border border-linha-forte bg-superficie text-tinta-suave flex-[1_1_220px] min-w-[200px] max-w-[360px]">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <span className="sr-only">{pesquisa.rotulo ?? "Pesquisar"}</span>
          <input
            type="search"
            value={texto}
            onChange={e => escrever(e.target.value)}
            placeholder={pesquisa.placeholder ?? "Pesquisar…"}
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm text-tinta"
          />
        </label>
      )}
      {selecoes.map(s => (
        <div key={s.chave} className="min-w-[140px] max-w-[260px] flex-1 sm:flex-none sm:w-auto">
          <label className="sr-only" htmlFor={`filtro-${s.chave}`}>{s.rotulo}</label>
          <Selecao
            id={`filtro-${s.chave}`}
            opcoes={s.opcoes}
            vazio={s.vazio ?? `${s.rotulo}: todos`}
            value={s.valor}
            onChange={e => s.onMudar(e.target.value)}
          />
        </div>
      ))}
      {periodo && (
        <span className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-controlo border border-linha-forte text-[13px] text-tinta-suave">
          <label className="inline-flex items-center gap-1.5">De
            <input type="date" value={periodo.de} onChange={e => periodo.onMudar(e.target.value, periodo.ate)} className="bg-transparent border-0 text-tinta text-[13px]" />
          </label>
          <label className="inline-flex items-center gap-1.5">até
            <input type="date" value={periodo.ate} onChange={e => periodo.onMudar(periodo.de, e.target.value)} className="bg-transparent border-0 text-tinta text-[13px]" />
          </label>
        </span>
      )}
      {extra}
      {ativos > 0 && onLimpar && (
        <Botao variante="ligacao" tamanho="sm" onClick={onLimpar} className="ml-auto">
          Limpar filtros ({ativos})
        </Botao>
      )}
    </div>
  );
}

/**
 * Filtros que se abrem e fecham: a pesquisa e o `extra` ficam sempre à vista; as seleções e o período ficam num
 * painel que se abre com «Filtros». Lá, as escolhas só valem ao carregar em «Aplicar», que fecha o painel para a
 * tabela ficar à vista.
 */
export function FiltrosColapsaveis({
  pesquisa, selecoes = [], periodo, ativos = 0, onLimpar, extra,
}: {
  pesquisa?: { valor: string; onMudar: (v: string) => void; placeholder?: string; rotulo?: string };
  selecoes?: FiltroSelecao[];
  periodo?: { de: string; ate: string; onMudar: (de: string, ate: string) => void };
  ativos?: number;
  onLimpar?: () => void;
  extra?: ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  const atuais = useCallback(() => ({
    sel: Object.fromEntries(selecoes.map(s => [s.chave, s.valor])) as Valores,
    de: periodo?.de ?? "", ate: periodo?.ate ?? "",
  }), [selecoes, periodo?.de, periodo?.ate]);
  const [rascunho, setRascunho] = useState(atuais);
  // Ao abrir, o rascunho parte do que está aplicado.
  useEffect(() => { if (aberto) setRascunho(atuais()); }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  const noPainel = selecoes.filter(s => s.valor).length + (periodo && (periodo.de || periodo.ate) ? 1 : 0);

  function aplicar() {
    for (const s of selecoes) if ((rascunho.sel[s.chave] ?? "") !== s.valor) s.onMudar(rascunho.sel[s.chave] ?? "");
    if (periodo && (rascunho.de !== periodo.de || rascunho.ate !== periodo.ate)) periodo.onMudar(rascunho.de, rascunho.ate);
    setAberto(false);
  }

  return (
    <div className="bg-superficie border border-linha rounded-cartao">
      <Filtros
        moldura={false}
        className="px-3 py-2.5"
        pesquisa={pesquisa}
        ativos={ativos}
        onLimpar={onLimpar ? () => { onLimpar(); setAberto(false); } : undefined}
        extra={(
          <>
            <button type="button" aria-expanded={aberto} onClick={() => setAberto(a => !a)}
              className={cx("inline-flex h-9 items-center gap-2 rounded-controlo border px-3 text-[13px] font-semibold",
                aberto || noPainel ? "border-tinta text-tinta" : "border-linha-forte text-tinta-suave hover:text-tinta")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M3 5h18l-7 8v6l-4-2v-4z" /></svg>
              Filtros{noPainel ? ` (${noPainel})` : ""}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true" className={cx("transition-transform", aberto && "rotate-180")}><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {extra}
          </>
        )}
      />
      {aberto && (
        <form className="border-t border-linha px-3 py-3" onSubmit={e => { e.preventDefault(); aplicar(); }}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {selecoes.map(s => (
              <label key={s.chave} className="block">
                <span className="mb-1 block text-xs font-semibold text-tinta-suave">{s.rotulo}</span>
                <Selecao opcoes={s.opcoes} vazio={s.vazio ?? `${s.rotulo}: todos`} value={rascunho.sel[s.chave] ?? ""}
                  onChange={e => { const v = e.target.value; setRascunho(r => ({ ...r, sel: { ...r.sel, [s.chave]: v } })); }} />
              </label>
            ))}
            {periodo && (
              <div className="block">
                <span className="mb-1 block text-xs font-semibold text-tinta-suave">Período</span>
                <span className="inline-flex h-9 w-full items-center gap-1.5 rounded-controlo border border-linha-forte px-2.5 text-[13px] text-tinta-suave">
                  <label className="inline-flex items-center gap-1.5">De
                    <input type="date" value={rascunho.de} onChange={e => { const v = e.target.value; setRascunho(r => ({ ...r, de: v })); }} className="bg-transparent border-0 text-tinta text-[13px]" />
                  </label>
                  <label className="inline-flex items-center gap-1.5">até
                    <input type="date" value={rascunho.ate} onChange={e => { const v = e.target.value; setRascunho(r => ({ ...r, ate: v })); }} className="bg-transparent border-0 text-tinta text-[13px]" />
                  </label>
                </span>
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Botao variante="secundario" tamanho="sm" onClick={() => setAberto(false)}>Cancelar</Botao>
            <Botao variante="primario" tamanho="sm" type="submit">Aplicar filtros</Botao>
          </div>
        </form>
      )}
    </div>
  );
}
