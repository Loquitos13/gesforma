import { Botao } from "./Botao";
import { num } from "./formatos";

/** Paginação do servidor: "1–25 de 312" e anterior/seguinte. */
export function Paginacao({ pagina, porPagina, total, onMudar }: { pagina: number; porPagina: number; total: number; onMudar: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total === 0) return null;
  const de = (pagina - 1) * porPagina + 1;
  const ate = Math.min(total, pagina * porPagina);
  return (
    <nav aria-label="Paginação" className="num flex items-center gap-3 px-4 py-3 text-[13px] text-tinta-suave">
      <span>{num(de)}–{num(ate)} de {num(total)}</span>
      <span className="ml-auto flex items-center gap-1">
        <Botao tamanho="sm" variante="secundario" disabled={pagina <= 1} onClick={() => onMudar(pagina - 1)} aria-label="Página anterior">‹</Botao>
        <span className="px-2">Página {pagina} de {paginas}</span>
        <Botao tamanho="sm" variante="secundario" disabled={pagina >= paginas} onClick={() => onMudar(pagina + 1)} aria-label="Página seguinte">›</Botao>
      </span>
    </nav>
  );
}
