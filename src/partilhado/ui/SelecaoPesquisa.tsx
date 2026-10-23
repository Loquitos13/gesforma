import { useEffect, useId, useMemo, useRef, useState } from "react";
import { CONTROLO, type OpcaoSelecao } from "./Campo";
import { cx } from "./formatos";

const semAcentos = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Select com pesquisa: abre uma lista com caixa de pesquisa (setas, Enter e Esc funcionam).
 * Uso igual ao de Selecao dentro de Campo: <Campo rotulo="Programa">{p => <SelecaoPesquisa {...p} ... />}</Campo>
 */
export function SelecaoPesquisa({
  id, value, onChange, opcoes, vazio, placeholder = "Pesquisar…", disabled, className, ...aria
}: {
  id?: string;
  value: string;
  onChange: (valor: string) => void;
  opcoes: OpcaoSelecao[];
  /** Texto da opção vazia (ex.: "Sem programa"); sem ela, não há como limpar. */
  vazio?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  required?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState("");
  const [ativo, setAtivo] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const pesquisa = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const listaId = useId();

  const todas = useMemo(() => (vazio != null ? [{ valor: "", rotulo: vazio }, ...opcoes] : opcoes), [opcoes, vazio]);
  const filtradas = useMemo(() => {
    const t = semAcentos(q.trim());
    return t ? todas.filter(o => semAcentos(o.rotulo).includes(t)) : todas;
  }, [todas, q]);
  const atual = todas.find(o => o.valor === value);

  useEffect(() => {
    if (!aberto) return;
    setQ("");
    setAtivo(Math.max(0, todas.findIndex(o => o.valor === value)));
    pesquisa.current?.focus();
    const fora = (e: MouseEvent) => { if (!raiz.current?.contains(e.target as Node)) setAberto(false); };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);
  useEffect(() => { lista.current?.querySelector<HTMLElement>(`[data-i="${ativo}"]`)?.scrollIntoView({ block: "nearest" }); }, [ativo]);

  function escolher(o: OpcaoSelecao | undefined) {
    if (!o) return;
    onChange(o.valor);
    setAberto(false);
  }

  return (
    <div ref={raiz} className={cx("relative", className)}>
      <button
        type="button" id={id} disabled={disabled} aria-haspopup="listbox" aria-expanded={aberto} aria-controls={listaId} {...aria}
        onClick={() => setAberto(a => !a)}
        onKeyDown={e => { if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") { e.preventDefault(); setAberto(true); } }}
        className={cx(CONTROLO, "flex h-9 items-center justify-between gap-2 px-2.5 text-left")}
      >
        <span className={cx("truncate", !atual?.valor && "text-tinta-suave")}>{atual?.rotulo ?? (value || vazio || "Escolher…")}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-tinta-suave" fill="currentColor"><path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" /></svg>
      </button>
      {aberto && (
        <div className="absolute left-0 right-0 z-[70] mt-1 overflow-hidden rounded-controlo border border-linha-forte bg-superficie shadow-flutuante">
          <div className="border-b border-linha p-1.5">
            <input
              ref={pesquisa} value={q} placeholder={placeholder} aria-label={placeholder} aria-controls={listaId}
              aria-activedescendant={filtradas[ativo] ? `${listaId}-${ativo}` : undefined}
              onChange={e => { setQ(e.target.value); setAtivo(0); }}
              onKeyDown={e => {
                if (e.key === "ArrowDown") { e.preventDefault(); setAtivo(i => Math.min(filtradas.length - 1, i + 1)); }
                else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo(i => Math.max(0, i - 1)); }
                else if (e.key === "Enter") { e.preventDefault(); escolher(filtradas[ativo]); }
                else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setAberto(false); }
              }}
              className={cx(CONTROLO, "h-8 px-2")}
            />
          </div>
          <ul ref={lista} id={listaId} role="listbox" className="m-0 max-h-60 list-none overflow-y-auto p-1">
            {filtradas.map((o, i) => (
              <li
                key={o.valor || "__vazio"} id={`${listaId}-${i}`} data-i={i} role="option" aria-selected={o.valor === value}
                onMouseEnter={() => setAtivo(i)} onMouseDown={e => { e.preventDefault(); escolher(o); }}
                className={cx("cursor-pointer rounded px-2 py-1.5 text-sm", i === ativo && "bg-fundo", o.valor === value ? "font-semibold text-tinta" : o.valor ? "text-tinta" : "text-tinta-suave")}
              >
                {o.rotulo}
              </li>
            ))}
            {filtradas.length === 0 && <li className="px-2 py-1.5 text-sm text-tinta-suave">Sem resultados.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
