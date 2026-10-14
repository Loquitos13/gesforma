import type { ReactNode } from "react";
import { cx } from "./formatos";

/** Caixa branca com borda. `titulo` e `acoes` desenham o cabeçalho; `semPadding` para tabelas. */
export function Cartao({
  titulo, subtitulo, acoes, children, className, semPadding, as: Tag = "section", id,
}: {
  titulo?: ReactNode;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
  children?: ReactNode;
  className?: string;
  semPadding?: boolean;
  as?: "section" | "div" | "article";
  id?: string;
}) {
  const temCabecalho = titulo || acoes;
  return (
    <Tag id={id} className={cx("bg-superficie border border-linha rounded-cartao min-w-0", !semPadding && "p-5", className)}>
      {temCabecalho && (
        <div className={cx("flex items-start gap-3 flex-wrap", semPadding ? "px-5 py-4 border-b border-linha" : "mb-3")}>
          <div className="min-w-0 flex-1">
            {titulo && <h2 className="text-[15px] font-semibold text-tinta m-0">{titulo}</h2>}
            {subtitulo && <p className="text-[13px] text-tinta-suave mt-0.5 mb-0">{subtitulo}</p>}
          </div>
          {acoes && <div className="flex items-center gap-2 flex-wrap">{acoes}</div>}
        </div>
      )}
      {children}
    </Tag>
  );
}

/** Lista de pares rótulo/valor, para fichas. */
export function Detalhes({ itens, colunas = 2 }: { itens: { rotulo: ReactNode; valor: ReactNode }[]; colunas?: 1 | 2 | 3 }) {
  return (
    <dl className={cx("grid gap-x-6 gap-y-3 m-0", colunas === 1 ? "grid-cols-1" : colunas === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3")}>
      {itens.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-xs text-tinta-suave">{it.rotulo}</dt>
          <dd className="m-0 mt-0.5 text-sm text-tinta break-words">{it.valor ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
