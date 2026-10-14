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
}

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
    const voltar = () => setValores(lerUrl(padraoRef.current));
    window.addEventListener("popstate", voltar);
    return () => window.removeEventListener("popstate", voltar);
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
  pesquisa, selecoes = [], periodo, ativos = 0, onLimpar, extra, className,
}: {
  pesquisa?: { valor: string; onMudar: (v: string) => void; placeholder?: string; rotulo?: string };
  selecoes?: FiltroSelecao[];
  periodo?: { de: string; ate: string; onMudar: (de: string, ate: string) => void };
  ativos?: number;
  onLimpar?: () => void;
  extra?: ReactNode;
  className?: string;
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
    <div className={cx("flex flex-wrap items-center gap-2 bg-superficie border border-linha rounded-cartao p-2.5", className)}>
      {pesquisa && (
        <label className="flex items-center gap-2 h-10 px-3 rounded-controlo border border-linha-forte bg-superficie text-tinta-suave flex-1 min-w-[200px]">
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
        <div key={s.chave} className="min-w-[150px] max-w-[260px] flex-1 sm:flex-none">
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
        <span className="inline-flex items-center gap-1.5 h-10 px-2.5 rounded-controlo border border-linha-forte text-[13px] text-tinta-suave">
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
