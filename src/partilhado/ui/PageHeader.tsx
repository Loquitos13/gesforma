import type { ReactNode } from "react";
import { cx } from "./formatos";

export type Migalha = { rotulo: string; onClick?: () => void };

/**
 * Topo de cada ecrã: título, subtítulo e acções principais. As migalhas vivem só no
 * cabeçalho global (como no canvas); `trilho` fica aceite por compatibilidade e é ignorado.
 */
export function PageHeader({ titulo, subtitulo, acoes, etiqueta, className }: {
  trilho?: Migalha[];
  titulo: ReactNode;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  /** Etiqueta curta junto ao título (ex.: "Financiada"). */
  etiqueta?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex items-end gap-3 flex-wrap", className)}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="m-0 text-[22px] font-semibold tracking-[-0.01em] text-tinta">{titulo}</h1>
          {etiqueta}
        </div>
        {subtitulo && <p className="num m-0 mt-1 text-sm text-tinta-suave">{subtitulo}</p>}
      </div>
      {acoes && <div className="flex items-center gap-2 flex-wrap">{acoes}</div>}
    </div>
  );
}

export function Migalhas({ itens, className }: { itens: Migalha[]; className?: string }) {
  return (
    <nav aria-label="Localização" className={cx("text-[13px] text-tinta-suave", className)}>
      <ol className="m-0 p-0 list-none flex items-center flex-wrap">
        {itens.map((m, i) => {
          const ultimo = i === itens.length - 1;
          return (
            <li key={`${m.rotulo}-${i}`} className="flex items-center">
              {i > 0 && <span aria-hidden="true" className="px-1.5 text-tinta-fraca">/</span>}
              {m.onClick && !ultimo ? (
                <button type="button" onClick={m.onClick} className="hover:text-tinta hover:underline">{m.rotulo}</button>
              ) : (
                <span aria-current={ultimo ? "page" : undefined} className={cx(ultimo && "text-tinta font-semibold")}>{m.rotulo}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
