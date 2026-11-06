import { Botao } from "./Botao";
import { num } from "./formatos";

/** Paginação do servidor: "1–25 de 312" e anterior/seguinte. */
/** Linhas por página que se podem escolher (o servidor aceita até 200). */
export const OPCOES_POR_PAGINA = [25, 50, 100, 200];

/**
 * Paginação feita no servidor: «1–25 de 300», páginas e (com `onPorPagina`) quantas linhas mostrar. Mudar o número de
 * linhas volta à primeira página (quem chama trata disso).
 */
export function Paginacao({ pagina, porPagina, total, onMudar, onPorPagina, opcoes = OPCOES_POR_PAGINA }: {
  pagina: number; porPagina: number; total: number; onMudar: (p: number) => void;
  onPorPagina?: (n: number) => void; opcoes?: number[];
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total === 0) return null;
  const de = (pagina - 1) * porPagina + 1;
  const ate = Math.min(total, pagina * porPagina);
  return (
    <nav aria-label="Paginação" className="num flex items-center gap-3 px-4 py-3 text-[13px] text-tinta-suave">
      <span>{num(de)}–{num(ate)} de {num(total)}</span>
      {onPorPagina && (
        <label className="flex items-center gap-2">
          Por página
          <select value={porPagina} onChange={e => onPorPagina(Number(e.target.value))}
            className="h-8 rounded-controlo border border-linha-forte bg-superficie px-2 text-[13px] text-tinta">
            {[...new Set([...opcoes, porPagina])].sort((a, b) => a - b).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
      <span className="ml-auto flex items-center gap-1">
        <Botao tamanho="sm" variante="secundario" disabled={pagina <= 1} onClick={() => onMudar(pagina - 1)} aria-label="Página anterior">‹</Botao>
        <span className="px-2">Página {pagina} de {paginas}</span>
        <Botao tamanho="sm" variante="secundario" disabled={pagina >= paginas} onClick={() => onMudar(pagina + 1)} aria-label="Página seguinte">›</Botao>
      </span>
    </nav>
  );
}
