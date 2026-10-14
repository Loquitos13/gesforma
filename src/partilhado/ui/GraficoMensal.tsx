import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Evolucao } from "./Chip";
import { cx, evolucao, formatar, num, type Formato } from "./formatos";

export type EstatisticaMes = {
  id: string;
  rotulo: string;
  valor: number;
  formato?: Formato;
  /** Comparar em pontos percentuais (para valores que já são %). */
  pp?: boolean;
  /** Descer é bom (ex.: documentos em falta). */
  inverso?: boolean;
};

export type MesGrafico = {
  /** "2026-10" */
  chave: string;
  /** Rótulo do eixo: "out". */
  curto: string;
  /** Título do cartão: "outubro 2026". */
  titulo: string;
  /** Valor da barra. */
  valor: number;
  emCurso?: boolean;
  stats: EstatisticaMes[];
  porCurso: { nome: string; valor: number }[];
  conheceu: { rotulo: string; n: number }[];
};

type Modo = "anterior" | "ano";

/**
 * Barras mensais com cartão ao passar o rato (ou foco) e clique para fixar.
 * O cartão compara o mês com o anterior ou com o mesmo mês do ano passado:
 * estatísticas, valor por curso e "Como conheceram a ENA".
 * `serie` vem por ordem cronológica e pode ter 24 meses: mostram-se os últimos `visiveis`.
 */
export function GraficoMensal({
  serie, visiveis = 12, formato, rotulo, tituloPorCurso = "Por curso", formatoPorCurso, inicialFixo,
}: {
  serie: MesGrafico[];
  visiveis?: number;
  formato: Formato;
  rotulo: string;
  tituloPorCurso?: string;
  formatoPorCurso?: Formato;
  inicialFixo?: string | null;
}) {
  const inicio = Math.max(0, serie.length - visiveis);
  const meses = serie.slice(inicio);
  const [hover, setHover] = useState<number | null>(null);
  const [fixo, setFixo] = useState<number | null>(() => {
    const i = inicialFixo ? meses.findIndex(m => m.chave === inicialFixo) : -1;
    return i >= 0 ? i : null;
  });
  const [modo, setModo] = useState<Modo>("anterior");
  const sair = useRef<number | null>(null);
  useEffect(() => () => { if (sair.current) window.clearTimeout(sair.current); }, []);

  const max = Math.max(...meses.map(m => m.valor), 0);
  const totalJanela = meses.reduce((s, m) => s + m.valor, 0);
  const aberto = hover ?? fixo;
  const estaFixo = fixo != null && hover == null;

  function entrar(i: number) {
    if (sair.current) window.clearTimeout(sair.current);
    setHover(i);
  }
  function deixar() {
    if (sair.current) window.clearTimeout(sair.current);
    sair.current = window.setTimeout(() => setHover(null), 200);
  }
  function manter() {
    if (sair.current) window.clearTimeout(sair.current);
  }

  if (!meses.length) return <p className="m-0 text-[13px] text-tinta-suave">Sem dados.</p>;

  return (
    <div className="relative">
      <div role="group" aria-label={rotulo} className="flex items-end gap-1.5 sm:gap-2.5 h-[200px] pt-2 border-b border-linha">
        {meses.map((m, i) => {
          const ligado = aberto === i;
          const h = max ? Math.max(1.5, (m.valor / max) * 100) : 0;
          return (
            <button
              key={m.chave}
              type="button"
              aria-label={`${m.titulo}: ${formatar(m.valor, formato)}${m.emCurso ? " (mês em curso)" : ""}`}
              aria-pressed={fixo === i}
              onMouseEnter={() => entrar(i)}
              onMouseLeave={deixar}
              onFocus={() => entrar(i)}
              onBlur={deixar}
              onClick={() => { setFixo(i); setHover(null); }}
              className="flex-1 h-full flex flex-col justify-end items-stretch bg-transparent p-0 border-0 cursor-pointer transition-opacity"
              style={{ opacity: aberto != null && !ligado ? 0.45 : 1 }}
            >
              <span
                className="block rounded-t-[3px]"
                style={{ height: `${h}%`, background: ligado ? "#FFB020" : m.emCurso ? "#9DB5D3" : "#1D4E89" }}
              />
            </button>
          );
        })}
      </div>
      <div className="num flex gap-1.5 sm:gap-2.5 pt-1.5 text-[11px] text-tinta-suave" aria-hidden="true">
        {meses.map((m, i) => (
          <span key={m.chave} className={cx("flex-1 text-center", aberto === i && "font-bold text-tinta")}>{m.curto}</span>
        ))}
      </div>

      {aberto != null && meses[aberto] && (
        <CartaoMes
          serie={serie}
          indice={inicio + aberto}
          posicao={aberto}
          visiveis={meses.length}
          totalJanela={totalJanela}
          formato={formato}
          formatoPorCurso={formatoPorCurso ?? formato}
          tituloPorCurso={tituloPorCurso}
          modo={modo}
          onModo={md => { setModo(md); setFixo(aberto); setHover(null); }}
          fixo={estaFixo}
          onFechar={() => { setFixo(null); setHover(null); }}
          onEntrar={manter}
          onSair={deixar}
        />
      )}
    </div>
  );
}

function CartaoMes({
  serie, indice, posicao, visiveis, totalJanela, formato, formatoPorCurso, tituloPorCurso, modo, onModo, fixo, onFechar, onEntrar, onSair,
}: {
  serie: MesGrafico[];
  indice: number;
  posicao: number;
  visiveis: number;
  totalJanela: number;
  formato: Formato;
  formatoPorCurso: Formato;
  tituloPorCurso: string;
  modo: Modo;
  onModo: (m: Modo) => void;
  fixo: boolean;
  onFechar: () => void;
  onEntrar: () => void;
  onSair: () => void;
}) {
  const m = serie[indice]!;
  const iAnterior = indice - 1;
  const iAno = indice - 12;
  const outro = modo === "anterior" ? serie[iAnterior] : serie[iAno];
  const parte = totalJanela ? Math.round((m.valor / totalJanela) * 100) : 0;
  const metade = posicao < visiveis / 2;
  const estilo = { "--pos": `calc(${((metade ? posicao + 1 : visiveis - posicao) / visiveis) * 100}% + 8px)` } as CSSProperties;

  const cursos = [...m.porCurso].sort((a, b) => b.valor - a.valor).slice(0, 6);
  const conheceu = [...m.conheceu].sort((a, b) => b.n - a.n);
  const maxConheceu = Math.max(...conheceu.map(c => c.n), 0);
  const curto = (x?: MesGrafico) => (x ? `${x.curto} ${x.chave.slice(2, 4)}` : "—");

  return (
    <div
      onMouseEnter={onEntrar}
      onMouseLeave={onSair}
      style={estilo}
      className={cx(
        "num mt-3 sm:mt-0 sm:absolute sm:top-0 sm:z-30 w-full sm:w-[380px] bg-superficie border border-linha border-l-4 border-l-acao rounded-painel shadow-flutuante text-[13px]",
        metade ? "sm:[left:var(--pos)]" : "sm:[right:var(--pos)]",
      )}
    >
      <div className="flex items-start gap-3 px-4 pt-3.5 pb-2.5">
        <div className="flex-1">
          <p className="m-0 text-xs text-tinta-suave">{m.titulo}{m.emCurso ? " · mês em curso" : ""}</p>
          <p className="m-0 mt-1 text-[26px] leading-none font-bold text-tinta">{formatar(m.valor, formato)}</p>
          <span className="inline-block mt-2 px-2 py-0.5 rounded-full bg-acao-suave text-acao-texto text-[11px] font-semibold">
            {num(parte)} % dos últimos {visiveis} meses
          </span>
        </div>
        {fixo && (
          <button type="button" aria-label="Fechar" onClick={onFechar} className="h-8 w-8 rounded-full text-tinta-suave hover:bg-linha-suave hover:text-tinta text-lg leading-none">×</button>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 pb-2.5 flex-wrap">
        <span className="text-[11px] font-semibold text-tinta-suave">Comparar com</span>
        <div role="group" aria-label="Comparar com" className="ml-auto inline-flex rounded-controlo bg-linha-suave p-0.5">
          {([["anterior", `Mês anterior · ${curto(serie[iAnterior])}`], ["ano", `Ano passado · ${curto(serie[iAno])}`]] as const).map(([id, txt]) => (
            <button
              key={id}
              type="button"
              aria-pressed={modo === id}
              onClick={() => onModo(id)}
              className={cx("h-[26px] px-2.5 rounded-md text-[11px] font-semibold", modo === id ? "bg-superficie text-tinta shadow-sm" : "text-tinta-suave")}
            >
              {txt}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-4 rounded-controlo bg-fundo px-2.5 py-2">
        <div className="grid grid-cols-[minmax(0,1fr)_72px_72px_64px] gap-1.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.04em] text-tinta-fraca">
          <span />
          <span className="text-right">{curto(m)}</span>
          <span className="text-right">{curto(outro)}</span>
          <span className="text-right">Evolução</span>
        </div>
        {m.stats.map(s => {
          const b = outro?.stats.find(x => x.id === s.id);
          const e = b ? evolucao(s.valor, b.valor, { pp: s.pp, inverso: s.inverso }) : { texto: "—", tom: "neutro" as const };
          const f = s.formato ?? "num";
          return (
            <div key={s.id} className="grid grid-cols-[minmax(0,1fr)_72px_72px_64px] gap-1.5 items-center py-1 border-t border-linha text-xs">
              <span className="text-tinta">{s.rotulo}</span>
              <span className="text-right font-bold text-tinta">{formatar(s.valor, f)}</span>
              <span className="text-right text-tinta-suave">{b ? formatar(b.valor, f) : "—"}</span>
              <span className="text-right"><Evolucao texto={e.texto} tom={e.tom} /></span>
            </div>
          );
        })}
      </div>

      {cursos.length > 0 && (
        <div className="px-4 pt-3">
          <p className="m-0 mb-1.5 text-[11px] font-semibold text-tinta-suave">{tituloPorCurso}</p>
          {cursos.map(c => {
            const b = outro?.porCurso.find(x => x.nome === c.nome);
            const e = evolucao(c.valor, b?.valor ?? 0);
            return (
              <div key={c.nome} className="grid grid-cols-[minmax(0,1fr)_72px_56px] gap-2 items-center py-0.5 text-xs">
                <span className="truncate text-tinta" title={c.nome}>{c.nome}</span>
                <span className="text-right font-semibold text-tinta">{formatar(c.valor, formatoPorCurso)}</span>
                <span className="text-right"><Evolucao texto={e.texto} tom={e.tom} /></span>
              </div>
            );
          })}
        </div>
      )}

      {conheceu.length > 0 && (
        <div className="px-4 pt-3">
          <p className="m-0 mb-1.5 text-[11px] font-semibold text-tinta-suave">Como conheceram a ENA <span className="font-normal">· pré-inscrições do mês</span></p>
          {conheceu.map(c => {
            const b = outro?.conheceu.find(x => x.rotulo === c.rotulo);
            const e = evolucao(c.n, b?.n ?? 0);
            return (
              <div key={c.rotulo} className="grid grid-cols-[96px_minmax(0,1fr)_70px_56px] gap-2 items-center py-0.5 text-xs">
                <span className="truncate text-tinta">{c.rotulo}</span>
                <span className="relative h-1.5 rounded bg-linha-suave" aria-hidden="true">
                  <span className="absolute inset-y-0 left-0 rounded bg-aviso" style={{ width: `${maxConheceu ? (c.n / maxConheceu) * 100 : 0}%` }} />
                </span>
                <span className="text-right"><strong className="font-semibold text-tinta">{num(c.n)}</strong> <span className="text-tinta-fraca">vs {num(b?.n ?? 0)}</span></span>
                <span className="text-right"><Evolucao texto={e.texto} tom={e.tom} /></span>
              </div>
            );
          })}
        </div>
      )}

      <p className="m-0 px-4 pt-2.5 pb-3 text-[11px] text-tinta-fraca">
        {fixo ? "Fixado. Fecha no × ou clique noutra barra." : "Clique na barra para fixar e mudar a comparação."}
      </p>
    </div>
  );
}
