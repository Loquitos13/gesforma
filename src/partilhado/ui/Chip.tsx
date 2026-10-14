import type { ReactNode } from "react";
import { cx, TOM_CLASSES, type Tom } from "./formatos";

/** Estado de um registo (pill colorida). Usar o tom para o significado, não para decorar. */
export function Estado({ tom = "neutro", children, ponto, className, title }: { tom?: Tom; children: ReactNode; ponto?: boolean; className?: string; title?: string }) {
  const t = TOM_CLASSES[tom];
  return (
    <span title={title} className={cx("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap", t.fundo, t.texto, className)}>
      {ponto && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** Etiqueta neutra; com `onRemover` mostra um × (filtros activos, etiquetas). */
export function Chip({ children, onRemover, ativo, onClick, className, contagem }: {
  children: ReactNode;
  onRemover?: () => void;
  ativo?: boolean;
  onClick?: () => void;
  className?: string;
  contagem?: number;
}) {
  const base = cx(
    "inline-flex items-center gap-1.5 rounded-full border text-[13px] h-8 px-3 whitespace-nowrap",
    ativo ? "bg-tinta text-white border-tinta" : "bg-superficie text-tinta border-linha-forte",
    onClick && !ativo && "hover:bg-fundo",
    className,
  );
  const conteudo = (
    <>
      {children}
      {contagem != null && (
        <span className={cx("num rounded-full px-1.5 text-xs font-semibold", ativo ? "bg-white/20" : "bg-linha-suave text-tinta-suave")}>{contagem}</span>
      )}
    </>
  );
  if (onClick) {
    return <button type="button" aria-pressed={Boolean(ativo)} onClick={onClick} className={base}>{conteudo}</button>;
  }
  return (
    <span className={base}>
      {conteudo}
      {onRemover && (
        <button type="button" onClick={onRemover} aria-label="Remover" className="-mr-1 h-5 w-5 rounded-full text-tinta-suave hover:bg-linha-suave hover:text-tinta">
          ×
        </button>
      )}
    </span>
  );
}

/** Indicador de evolução (+12 %, −2 p.p.). */
export function Evolucao({ texto, tom }: { texto: string; tom: Tom }) {
  const t = TOM_CLASSES[tom];
  return <span className={cx("num inline-block rounded-full px-1.5 py-px text-[11px] font-bold", t.fundo, t.texto)}>{texto}</span>;
}
