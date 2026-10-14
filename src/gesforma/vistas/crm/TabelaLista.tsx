// Tabela das listas do CRM (clientes, parceiros, propostas, contratos, equipa), no desenho dos protótipos:
// cartão branco, cabeçalho cinzento, linha seleccionada realçada, teclado (Enter/Espaço abre a linha).
import type { ReactNode } from "react";

export type ColunaLista<T> = { titulo: string; celula: (l: T) => ReactNode; dir?: boolean; escondido?: boolean; largura?: string; corrido?: boolean };

export function TabelaLista<T>({ rotulo, colunas, linhas, chave, selecionado, onLinha, aCarregar, vazio, rodape, minimo = 640 }: {
  rotulo: string;
  colunas: ColunaLista<T>[];
  linhas: T[];
  chave: (l: T) => number | string;
  selecionado?: number | string | null;
  onLinha?: (l: T) => void;
  aCarregar?: boolean;
  vazio: ReactNode;
  rodape?: ReactNode;
  minimo?: number;
}) {
  return (
    <div className="bg-white border border-linha rounded-[10px] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" style={{ minWidth: minimo }} aria-label={rotulo}>
          <thead>
            <tr className="text-left text-tinta-suave text-xs">
              {colunas.map(c => (
                <th key={c.titulo} scope="col" style={{ width: c.largura }} className={`px-4 py-2.5 font-semibold border-b border-linha ${c.dir ? "text-right" : ""}`}>
                  {c.escondido ? <span className="sr-only">{c.titulo}</span> : c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {aCarregar && Array.from({ length: 5 }, (_, i) => (
              <tr key={`e${i}`}>{colunas.map(c => <td key={c.titulo} className="px-4 py-3.5 border-b border-[#EEF0F3]"><span className="block h-3.5 rounded bg-[#EEF0F3] animate-pulse w-3/4" /></td>)}</tr>
            ))}
            {!aCarregar && linhas.length === 0 && (
              <tr><td colSpan={colunas.length} className="px-4 py-10 text-center text-sm text-tinta-suave">{vazio}</td></tr>
            )}
            {!aCarregar && linhas.map(l => {
              const k = chave(l);
              const ativo = selecionado != null && k === selecionado;
              return (
                <tr
                  key={k}
                  tabIndex={onLinha ? 0 : undefined}
                  aria-selected={onLinha ? ativo : undefined}
                  onClick={onLinha ? () => onLinha(l) : undefined}
                  onKeyDown={onLinha ? e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onLinha(l); } } : undefined}
                  className={`${onLinha ? "cursor-pointer focus-visible:outline-2 focus-visible:outline-[#1D4E89] focus-visible:-outline-offset-2" : ""} ${ativo ? "bg-[#FFF8EA]" : onLinha ? "hover:bg-[#FAFBFC]" : ""}`}
                  style={ativo ? { boxShadow: "inset 3px 0 0 #FFB020" } : undefined}
                >
                  {colunas.map(c => (
                    <td key={c.titulo} className={`px-4 py-3 border-b border-[#EEF0F3] text-sm text-tinta align-middle ${c.dir ? "text-right" : ""} ${c.dir || c.corrido ? "whitespace-nowrap" : ""}`}>{c.celula(l)}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rodape}
    </div>
  );
}
