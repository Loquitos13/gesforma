import { cx, formatar, num, type Formato } from "./formatos";

export type ItemBarra = { rotulo: string; valor: number; detalhe?: string; onClick?: () => void };

/**
 * Barras horizontais com valor e percentagem do total. Para rankings e repartições
 * (origens, métodos de pagamento, cursos). Prefira isto a gráficos circulares.
 */
export function BarrasHorizontais({ itens, formato = "num", cor = "#1D4E89", mostrarPct = true, rotulo, larguraRotulo = 120, vazio = "Sem dados no período." }: {
  itens: ItemBarra[];
  formato?: Formato;
  cor?: string;
  mostrarPct?: boolean;
  rotulo: string;
  larguraRotulo?: number;
  vazio?: string;
}) {
  const total = itens.reduce((s, i) => s + i.valor, 0);
  const max = Math.max(...itens.map(i => i.valor), 0);
  if (!itens.length || total === 0) return <p className="m-0 text-[13px] text-tinta-suave">{vazio}</p>;
  return (
    <ul aria-label={rotulo} className="num m-0 p-0 list-none flex flex-col gap-2.5">
      {itens.map(it => {
        const pct = total ? Math.round((it.valor / total) * 100) : 0;
        const conteudo = (
          <span className="grid items-center gap-2.5 text-[13px]" style={{ gridTemplateColumns: `${larguraRotulo}px minmax(0,1fr) auto` }}>
            <span className="truncate text-tinta" title={it.detalhe ?? it.rotulo}>{it.rotulo}</span>
            <span className="relative h-2 rounded bg-linha-suave" aria-hidden="true">
              <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${max ? Math.max(2, (it.valor / max) * 100) : 0}%`, background: cor }} />
            </span>
            <span className="text-right whitespace-nowrap">
              <strong className="font-semibold text-tinta">{formatar(it.valor, formato)}</strong>
              {mostrarPct && <span className="text-tinta-suave"> · {num(pct)} %</span>}
            </span>
          </span>
        );
        return (
          <li key={it.rotulo}>
            {it.onClick ? (
              <button type="button" onClick={it.onClick} className={cx("w-full text-left rounded hover:bg-fundo")}>{conteudo}</button>
            ) : conteudo}
          </li>
        );
      })}
    </ul>
  );
}
