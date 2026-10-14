import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cx } from "./formatos";

export type Separador<T extends string> = { id: T; rotulo: ReactNode; contagem?: number; desativado?: boolean };

/**
 * Separadores (tablist). Setas esquerda/direita mudam de separador.
 * `estilo="linha"` para fichas; `estilo="pilula"` para filas de trabalho e filtros.
 */
export function Separadores<T extends string>({
  itens, ativo, onMudar, rotulo, estilo = "linha", className,
}: {
  itens: Separador<T>[];
  ativo: T;
  onMudar: (id: T) => void;
  rotulo: string;
  estilo?: "linha" | "pilula";
  className?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  function tecla(e: KeyboardEvent, i: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const passo = e.key === "ArrowRight" ? 1 : -1;
    for (let k = 1; k <= itens.length; k++) {
      const j = (i + passo * k + itens.length) % itens.length;
      if (!itens[j]!.desativado) {
        onMudar(itens[j]!.id);
        refs.current[j]?.focus();
        break;
      }
    }
  }
  return (
    <div role="tablist" aria-label={rotulo} className={cx("flex", estilo === "linha" ? "gap-1 overflow-x-auto border-b border-linha" : "gap-2 flex-wrap", className)}>
      {itens.map((it, i) => {
        const sel = it.id === ativo;
        return (
          <button
            key={it.id}
            ref={el => { refs.current[i] = el; }}
            type="button"
            role="tab"
            aria-selected={sel}
            tabIndex={sel ? 0 : -1}
            disabled={it.desativado}
            onClick={() => onMudar(it.id)}
            onKeyDown={e => tecla(e, i)}
            className={cx(
              "inline-flex items-center gap-2 whitespace-nowrap text-sm disabled:opacity-40",
              estilo === "linha"
                ? cx("h-10 px-3 -mb-px border-b-2", sel ? "border-acao text-tinta font-semibold" : "border-transparent text-tinta-suave hover:text-tinta")
                : cx("h-9 px-3 rounded-controlo border font-semibold", sel ? "bg-tinta text-white border-tinta font-semibold" : "bg-superficie text-tinta border-linha-forte hover:bg-fundo"),
            )}
          >
            {it.rotulo}
            {it.contagem != null && (
              <span className={cx("num rounded-full px-1.5 text-xs font-semibold", sel && estilo === "pilula" ? "bg-white/20" : "bg-linha-suave text-tinta-suave")}>
                {it.contagem}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
