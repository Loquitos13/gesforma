import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "./formatos";

export type Coluna<T> = {
  id: string;
  titulo: ReactNode;
  celula: (linha: T) => ReactNode;
  /** Permite ordenar por esta coluna (a chave enviada é `id`, ou `-id` descendente). */
  ordenavel?: boolean;
  alinhar?: "esq" | "dir" | "centro";
  largura?: string;
  /** No telemóvel: não mostrar. */
  esconderMovel?: boolean;
  /** No telemóvel: é o título do cartão. */
  principal?: boolean;
};

type Chave = string | number;

/**
 * Tabela de dados. Em ecrãs estreitos (< 640 px) passa a cartões.
 * Ordenação e paginação são do servidor: a tabela só mostra e avisa (`onOrdenar`).
 */
export function Tabela<T>({
  rotulo, linhas, colunas, chave, ordem, onOrdenar, selecao, onLinha, linhaAtiva, aCarregar, vazio, acoesLinha, alturaMax, className,
}: {
  rotulo: string;
  linhas: T[];
  colunas: Coluna<T>[];
  chave: (linha: T) => Chave;
  ordem?: string;
  onOrdenar?: (ordem: string) => void;
  selecao?: { selecionados: Set<Chave>; onMudar: (s: Set<Chave>) => void };
  onLinha?: (linha: T) => void;
  linhaAtiva?: Chave | null;
  aCarregar?: boolean;
  vazio?: ReactNode;
  acoesLinha?: (linha: T) => ReactNode;
  /** Altura máxima com scroll vertical (o cabeçalho fica fixo). */
  alturaMax?: string;
  className?: string;
}) {
  const campoOrdem = ordem?.replace(/^-/, "");
  const desc = ordem?.startsWith("-");
  const todos = linhas.length > 0 && selecao && linhas.every(l => selecao.selecionados.has(chave(l)));

  function alternarTodos() {
    if (!selecao) return;
    const s = new Set(selecao.selecionados);
    if (todos) linhas.forEach(l => s.delete(chave(l)));
    else linhas.forEach(l => s.add(chave(l)));
    selecao.onMudar(s);
  }
  function alternar(k: Chave) {
    if (!selecao) return;
    const s = new Set(selecao.selecionados);
    if (s.has(k)) s.delete(k); else s.add(k);
    selecao.onMudar(s);
  }
  function teclaLinha(e: KeyboardEvent, l: T) {
    if (onLinha && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      onLinha(l);
    }
  }
  const alinhar = (a?: Coluna<T>["alinhar"]) => (a === "dir" ? "text-right" : a === "centro" ? "text-center" : "text-left");
  const esqueleto = aCarregar && linhas.length === 0;

  return (
    <div className={cx("min-w-0", className)}>
      {/* Computador */}
      <div className={cx("hidden sm:block overflow-x-auto", alturaMax && "overflow-y-auto")} style={alturaMax ? { maxHeight: alturaMax } : undefined}>
        <table className="num w-full border-collapse text-[13px]" aria-label={rotulo} aria-busy={aCarregar || undefined}>
          <thead>
            <tr>
              {selecao && (
                <th scope="col" className="sticky top-0 z-10 bg-[#F9FAFB] w-10 px-3.5 py-2.5 border-b border-linha">
                  <input type="checkbox" aria-label="Seleccionar todas" checked={Boolean(todos)} onChange={alternarTodos} className="h-4 w-4 accent-[#1D4E89]" />
                </th>
              )}
              {colunas.map(c => {
                const ativa = campoOrdem === c.id;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    style={c.largura ? { width: c.largura } : undefined}
                    aria-sort={ativa ? (desc ? "descending" : "ascending") : undefined}
                    className={cx("sticky top-0 z-10 bg-[#F9FAFB] px-3.5 py-2.5 border-b border-linha text-xs font-semibold text-tinta-suave whitespace-nowrap", alinhar(c.alinhar))}
                  >
                    {c.ordenavel && onOrdenar ? (
                      <button
                        type="button"
                        onClick={() => onOrdenar(ativa && !desc ? `-${c.id}` : c.id)}
                        className="inline-flex items-center gap-1 hover:text-tinta"
                      >
                        {c.titulo}
                        <span aria-hidden="true" className={cx("text-[10px]", !ativa && "opacity-30")}>{ativa && desc ? "▼" : "▲"}</span>
                      </button>
                    ) : c.titulo}
                  </th>
                );
              })}
              {acoesLinha && <th scope="col" className="sticky top-0 z-10 bg-[#F9FAFB] px-3.5 py-2.5 border-b border-linha"><span className="sr-only">Acções</span></th>}
            </tr>
          </thead>
          <tbody>
            {esqueleto && Array.from({ length: 6 }).map((_, i) => (
              <tr key={`e${i}`}>
                {selecao && <td className="px-3.5 py-3 border-b border-linha-suave" />}
                {colunas.map(c => (
                  <td key={c.id} className="px-3.5 py-3 border-b border-linha-suave">
                    <span className="block h-3.5 rounded bg-linha-suave animate-pulse" style={{ width: `${50 + ((i * 7 + c.id.length * 13) % 45)}%` }} />
                  </td>
                ))}
                {acoesLinha && <td className="border-b border-linha-suave" />}
              </tr>
            ))}
            {!esqueleto && linhas.map(l => {
              const k = chave(l);
              const ativa = linhaAtiva != null && linhaAtiva === k;
              return (
                <tr
                  key={k}
                  tabIndex={onLinha ? 0 : undefined}
                  onClick={onLinha ? () => onLinha(l) : undefined}
                  onKeyDown={onLinha ? e => teclaLinha(e, l) : undefined}
                  aria-selected={onLinha ? ativa : undefined}
                  className={cx(onLinha && "cursor-pointer hover:bg-fundo focus-visible:bg-fundo", ativa && "bg-acao-suave/60")}
                >
                  {selecao && (
                    <td className="px-3.5 py-3 border-b border-linha-suave" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" aria-label="Seleccionar" checked={selecao.selecionados.has(k)} onChange={() => alternar(k)} className="h-4 w-4 accent-[#1D4E89]" />
                    </td>
                  )}
                  {colunas.map(c => (
                    <td key={c.id} className={cx("px-3.5 py-3 border-b border-linha-suave align-middle", alinhar(c.alinhar))}>{c.celula(l)}</td>
                  ))}
                  {acoesLinha && (
                    <td className="px-4 py-2 border-b border-linha-suave text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>{acoesLinha(l)}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Telemóvel */}
      <ul className="sm:hidden m-0 p-0 list-none divide-y divide-linha-suave" aria-label={rotulo}>
        {esqueleto && Array.from({ length: 4 }).map((_, i) => (
          <li key={i} className="p-4"><span className="block h-4 w-2/3 rounded bg-linha-suave animate-pulse" /></li>
        ))}
        {!esqueleto && linhas.map(l => {
          const k = chave(l);
          const principal = colunas.find(c => c.principal) ?? colunas[0];
          const resto = colunas.filter(c => c !== principal && !c.esconderMovel);
          const conteudo = (
            <>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 font-semibold text-tinta">{principal?.celula(l)}</div>
                {selecao && (
                  <input type="checkbox" aria-label="Seleccionar" checked={selecao.selecionados.has(k)} onChange={() => alternar(k)} onClick={e => e.stopPropagation()} className="h-4 w-4 accent-[#1D4E89]" />
                )}
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 m-0 text-[13px]">
                {resto.map(c => (
                  <div key={c.id} className="min-w-0">
                    <dt className="text-xs text-tinta-suave">{c.titulo}</dt>
                    <dd className="m-0 text-tinta break-words">{c.celula(l)}</dd>
                  </div>
                ))}
              </dl>
              {acoesLinha && <div className="mt-2 flex gap-2 flex-wrap" onClick={e => e.stopPropagation()}>{acoesLinha(l)}</div>}
            </>
          );
          return (
            <li key={k} className={cx("p-4", linhaAtiva === k && "bg-acao-suave/60")}>
              {onLinha ? (
                <div role="button" tabIndex={0} onClick={() => onLinha(l)} onKeyDown={e => teclaLinha(e, l)} className="cursor-pointer">{conteudo}</div>
              ) : conteudo}
            </li>
          );
        })}
      </ul>

      {!aCarregar && linhas.length === 0 && vazio}
    </div>
  );
}
