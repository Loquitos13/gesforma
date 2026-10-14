// Blocos do topo dos painéis: período e filtros, indicadores, "a tratar hoje", funil e "como conheceram a ENA".
import { useState } from "react";
import type { EtapaFunil, IndicadorPainel, Painel, RegimePainel, TarefaPainel } from "../../../partilhado/api/painel";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import {
  BarrasHorizontais, Cartao, Filtros, Kpi, KpiFaixa, Separadores, cx, evolucao, num, TOM_CLASSES, type FiltroSelecao,
} from "../../../partilhado/ui";
import type { Navegar } from "../../shell/tipos";
import { PRESETS, TAREFAS, capacidadeDaVista, destinoIndicador, destinoTarefa, type PresetPeriodo } from "./painelDados";

export type ValoresFiltro = {
  periodo: string; de: string; ate: string; curso: string; local: string; horario: string; financiador: string; eixo: string;
};

/** Período (atalhos + datas) e filtros de curso, local, horário e financiador. */
export function BarraFiltros({ regime, f, setF, limpar }: {
  regime: RegimePainel;
  f: ValoresFiltro;
  setF: (p: Partial<ValoresFiltro>) => void;
  limpar: () => void;
}) {
  const cursos = useOpcoes("cursos", { regime });
  const locais = useOpcoes("locais", { regime });
  const horarios = useOpcoes("horarios", { regime });
  const financiadores = useOpcoes("financiadores");
  const selecoes: FiltroSelecao[] = [
    { chave: "curso", rotulo: regime === "fin" ? "Curso / UFCD" : "Curso", opcoes: cursos.selecao, valor: f.curso, onMudar: v => setF({ curso: v }), vazio: regime === "fin" ? "Curso / UFCD: todos" : "Curso: todos" },
    { chave: "local", rotulo: "Local", opcoes: locais.selecao, valor: f.local, onMudar: v => setF({ local: v }) },
  ];
  if (regime === "gold") selecoes.push({ chave: "horario", rotulo: "Horário", opcoes: horarios.selecao, valor: f.horario, onMudar: v => setF({ horario: v }) });
  if (regime === "fin") selecoes.push({ chave: "financiador", rotulo: "Financiador", opcoes: financiadores.selecao, valor: f.financiador, onMudar: v => setF({ financiador: v }) });
  const ativos = [f.curso, f.local, f.horario, f.financiador].filter(Boolean).length + (f.periodo !== "mes" ? 1 : 0);
  const preset = f.periodo as PresetPeriodo;
  return (
    <Filtros
      selecoes={selecoes}
      periodo={preset === "livre" ? { de: f.de, ate: f.ate, onMudar: (de, ate) => setF({ de, ate }) } : undefined}
      ativos={ativos}
      onLimpar={limpar}
      extra={(
        <div role="group" aria-label="Período" className="inline-flex rounded-controlo border border-linha-forte overflow-hidden order-first">
          {PRESETS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              onClick={() => setF({ periodo: p.id })}
              className={cx(
                "h-10 px-3 text-[13px] font-semibold",
                i > 0 && "border-l border-linha-forte",
                preset === p.id ? "bg-tinta text-white" : "bg-superficie text-tinta hover:bg-fundo",
              )}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      )}
    />
  );
}

function textoDelta(k: IndicadorPainel, comparado: string) {
  if (k.anterior == null || k.valor == null) {
    return k.nota ? { texto: k.nota, tom: k.tom ?? "neutro" } : undefined;
  }
  const e = evolucao(k.valor, k.anterior, { pp: k.pp, inverso: k.inverso });
  if (e.delta == null) return { texto: `Sem base em ${comparado}`, tom: "neutro" as const };
  return { texto: `${e.texto} que ${comparado}`, tom: e.tom };
}

export function FaixaIndicadores({ regime, kpis, comparado, navigate, pode }: {
  regime: RegimePainel;
  kpis: IndicadorPainel[];
  comparado: string;
  navigate: Navegar;
  pode: (c: string) => boolean;
}) {
  return (
    <KpiFaixa>
      {kpis.map(k => {
        const destino = destinoIndicador(regime, k.id);
        const cap = destino ? capacidadeDaVista(destino.view) : null;
        const abre = destino && (!cap || pode(cap));
        return (
          <Kpi
            key={k.id}
            rotulo={k.rotulo}
            valor={k.valor}
            formato={k.formato}
            delta={textoDelta(k, comparado)}
            onClick={abre ? () => navigate(destino) : undefined}
            titulo={abre ? `Abrir ${k.rotulo.toLowerCase()}` : undefined}
          />
        );
      })}
    </KpiFaixa>
  );
}

export function CartaoATratar({ regime, tarefas, navigate, pode }: {
  regime: RegimePainel;
  tarefas: TarefaPainel[];
  navigate: Navegar;
  pode: (c: string) => boolean;
}) {
  const conhecidas = tarefas.filter(t => TAREFAS[regime][t.id]);
  const pendentes = conhecidas.filter(t => t.n > 0);
  return (
    <Cartao titulo="A tratar hoje" subtitulo={pendentes.length ? undefined : "Nada pendente. Tudo em dia."} className="flex flex-col">
      <ul className="m-0 p-0 list-none">
        {conhecidas.map(t => {
          const def = TAREFAS[regime][t.id]!;
          const destino = destinoTarefa(regime, t.id, t.leadId);
          const cap = destino ? capacidadeDaVista(destino.view) : null;
          const abre = destino && (!cap || pode(cap));
          const corpo = (
            <span className="num flex items-center gap-2.5 py-2.5 border-t border-linha-suave w-full text-left">
              <span className={cx("w-8 text-right text-base font-bold", t.n > 0 ? TOM_CLASSES[def.tom].texto : "text-tinta-fraca")}>{num(t.n)}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13px] font-semibold text-tinta">{def.titulo}</span>
                <span className="block text-xs text-tinta-suave truncate">{t.detalhe}</span>
              </span>
              {abre && <span aria-hidden="true" className="text-tinta-fraca">›</span>}
            </span>
          );
          return (
            <li key={t.id}>
              {abre ? (
                <button type="button" onClick={() => navigate(destino)} className="w-full bg-transparent border-0 p-0 rounded hover:bg-fundo">{corpo}</button>
              ) : corpo}
            </li>
          );
        })}
      </ul>
    </Cartao>
  );
}

function Etapas({ etapas }: { etapas: EtapaFunil[] }) {
  const base = etapas[0]?.n ?? 0;
  return (
    <ol className="m-0 p-0 list-none flex flex-col gap-3">
      {etapas.map(e => {
        const pct = base ? Math.round((e.n / base) * 100) : 0;
        return (
          <li key={e.id} className="num flex flex-col gap-1">
            <div className="flex text-[13px]">
              <span className="text-tinta">{e.rotulo}</span>
              <span className="ml-auto font-semibold text-tinta">{num(e.n)}</span>
              <span className="w-12 text-right text-tinta-suave">{base ? `${num(pct)} %` : "—"}</span>
            </div>
            <div className="relative h-2 rounded bg-linha-suave" aria-hidden="true">
              <span className="absolute inset-y-0 left-0 rounded bg-ligacao" style={{ width: `${pct}%` }} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function CartaoFunil({ regime, funil }: { regime: RegimePainel; funil: Painel["funil"] }) {
  const [trilho, setTrilho] = useState<"principal" | "prePagos">("principal");
  const temPrePagos = Boolean(funil.prePagos?.length);
  const etapas = trilho === "prePagos" && funil.prePagos ? funil.prePagos : funil.principal;
  return (
    <Cartao titulo={regime === "fin" ? "Funil de inscrição" : "Funil de conversão"}>
      {temPrePagos && (
        <Separadores
          rotulo="Tipo de entrada"
          estilo="pilula"
          ativo={trilho}
          onMudar={setTrilho}
          itens={[{ id: "principal", rotulo: "Pré-inscrições" }, { id: "prePagos", rotulo: "Acesso directo" }]}
          className="mb-3"
        />
      )}
      {(etapas[0]?.n ?? 0) === 0
        ? <p className="m-0 text-[13px] text-tinta-suave">Sem pré-inscrições no período.</p>
        : <Etapas etapas={etapas} />}
      <p className="m-0 mt-3 text-xs text-tinta-suave">
        {trilho === "prePagos"
          ? "Cursos com acesso directo: pagam antes e entram sem pré-inscrição."
          : "Pré-inscrições que entraram no período e onde estão hoje."}
      </p>
    </Cartao>
  );
}

export function CartaoConheceu({ regime, conheceu }: { regime: RegimePainel; conheceu: Painel["conheceu"] }) {
  const comBase = conheceu.filter(c => c.n >= 3);
  const melhor = [...comBase].sort((a, b) => b.convertidas / b.n - a.convertidas / a.n)[0];
  const taxa = (c: { n: number; convertidas: number }) => Math.round((c.convertidas / c.n) * 100);
  return (
    <Cartao titulo="Como conheceram a ENA">
      <BarrasHorizontais
        rotulo="Como conheceram a ENA"
        itens={conheceu.map(c => ({ rotulo: c.rotulo, valor: c.n, detalhe: `${c.rotulo}: ${c.convertidas} de ${c.n} ${regime === "fin" ? "validadas" : "passaram a formando"}` }))}
        cor="#9A5B00"
        larguraRotulo={110}
        vazio="Sem pré-inscrições no período."
      />
      <p className="m-0 mt-3 text-xs text-tinta-suave">
        Resposta do formulário do site.
        {melhor && melhor.convertidas > 0 ? ` ${regime === "fin" ? "Mais validadas" : "Conversão mais alta"}: ${melhor.rotulo} (${taxa(melhor)} %).` : ""}
      </p>
    </Cartao>
  );
}
