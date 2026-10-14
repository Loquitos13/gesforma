import type { ReactNode } from "react";
import { cx, formatar, TOM_CLASSES, type Formato, type Tom } from "./formatos";

/** Faixa de indicadores numa só caixa, separados por linhas finas. */
export function KpiFaixa({ children, className, rotulo = "Indicadores" }: { children: ReactNode; className?: string; rotulo?: string }) {
  return (
    <section aria-label={rotulo} className={cx("num grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 bg-superficie border border-linha rounded-cartao overflow-hidden", className)}>
      {children}
    </section>
  );
}

/**
 * Um indicador: rótulo, valor e uma linha de contexto (`delta`).
 * Com `onClick` torna-se um atalho para a lista correspondente.
 */
export function Kpi({ rotulo, valor, formato = "num", delta, onClick, titulo }: {
  rotulo: string;
  valor: number | string | null | undefined;
  formato?: Formato;
  delta?: { texto: string; tom: Tom } | string;
  onClick?: () => void;
  titulo?: string;
}) {
  const v = valor == null ? "—" : typeof valor === "number" ? formatar(valor, formato) : valor;
  const d = typeof delta === "string" ? { texto: delta, tom: "neutro" as Tom } : delta;
  const corpo = (
    <>
      <p className="m-0 text-xs text-tinta-suave">{rotulo}</p>
      <p className="m-0 mt-1.5 text-2xl font-semibold text-tinta">{v}</p>
      {d && <p className={cx("m-0 mt-0.5 text-xs", TOM_CLASSES[d.tom].texto)}>{d.texto}</p>}
    </>
  );
  const base = "flex flex-col justify-start items-stretch h-full text-left px-[18px] py-4 border-linha-suave [&:not(:first-child)]:border-l min-w-0";
  if (onClick) {
    return <button type="button" title={titulo} onClick={onClick} className={cx(base, "hover:bg-fundo")}>{corpo}</button>;
  }
  return <div title={titulo} className={base}>{corpo}</div>;
}
