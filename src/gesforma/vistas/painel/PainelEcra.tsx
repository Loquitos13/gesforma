// Painel Gold e Financiada: o mesmo ecrã, com blocos próprios de cada regime.
import { useMemo } from "react";
import { useAuth, usePode } from "../../../partilhado/AuthGate";
import { apiPainel, type EixoPainel, type RegimePainel } from "../../../partilhado/api/painel";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { Cartao, ErroCarregar, Esqueleto, GraficoMensal, PageHeader, eur, num, useFiltrosUrl } from "../../../partilhado/ui";
import type { Navegar } from "../../shell/tipos";
import { BarraFiltros, CartaoATratar, CartaoConheceu, CartaoFunil, FaixaIndicadores, type ValoresFiltro } from "./BlocosPainel";
import { CartaoDesagregacao, CartaoMetodos, CartaoProximas, TabelaTurmasEmCurso } from "./BlocosTurmas";
import { datasDoPeriodo, hojePorExtenso, paraGrafico, rotuloComparacao, type PresetPeriodo } from "./painelDados";

const PADRAO: ValoresFiltro = { periodo: "mes", de: "", ate: "", curso: "", local: "", horario: "", financiador: "", eixo: "curso" };

function Carregando() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="A carregar o painel">
      <Esqueleto linhas={1} altura="h-24" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Esqueleto linhas={1} altura="h-64" className="lg:col-span-2" />
        <Esqueleto linhas={1} altura="h-64" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Esqueleto linhas={1} altura="h-56" />
        <Esqueleto linhas={1} altura="h-56" />
        <Esqueleto linhas={1} altura="h-56" />
      </div>
    </div>
  );
}

export function PainelEcra({ regime, navigate }: { regime: RegimePainel; navigate: Navegar }) {
  const pode = usePode();
  const { user } = useAuth();
  const [f, setF, limpar] = useFiltrosUrl(PADRAO);
  const preset = (["mes", "trimestre", "ano", "livre"].includes(f.periodo) ? f.periodo : "mes") as PresetPeriodo;
  const datas = datasDoPeriodo(preset, f.de, f.ate);
  const eixo = (["curso", "local", "horario"].includes(f.eixo) ? f.eixo : "curso") as EixoPainel;
  const filtro = useMemo(() => ({
    de: datas.de || undefined,
    ate: datas.ate || undefined,
    curso: f.curso || undefined,
    local: f.local || undefined,
    horario: regime === "gold" ? f.horario || undefined : undefined,
    financiador: regime === "fin" ? f.financiador || undefined : undefined,
    eixo,
  }), [datas.de, datas.ate, f.curso, f.local, f.horario, f.financiador, eixo, regime]);
  const chave = `painel:${regime}:${JSON.stringify(filtro)}`;
  const { dados: p, erro, aCarregar, recarregar } = useRecurso(chave, signal => apiPainel(regime, filtro, signal));

  const comparado = rotuloComparacao(preset, p?.periodo.anterior);
  const serie = useMemo(() => (p ? paraGrafico(regime, p.serie) : []), [p, regime]);
  const total12 = serie.slice(-12).reduce((s, m) => s + m.valor, 0);
  const fin = regime === "fin";
  const titulo = fin ? "Painel Financiada" : "Painel Gold";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        trilho={[{ rotulo: fin ? "Financiada" : "Gold" }, { rotulo: "Painel" }]}
        titulo={titulo}
        subtitulo={`${hojePorExtenso()} · comparação com ${comparado}`}
      />
      <BarraFiltros regime={regime} f={f} setF={setF} limpar={limpar} />

      {erro && !p ? <ErroCarregar erro={erro} onTentar={recarregar} /> : null}
      {!p && !erro ? <Carregando /> : null}

      {p && (
        <div className={aCarregar ? "flex flex-col gap-5 opacity-70 transition-opacity" : "flex flex-col gap-5 transition-opacity"} aria-busy={aCarregar}>
          <FaixaIndicadores regime={regime} kpis={p.kpis} comparado={comparado} navigate={navigate} pode={pode} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Cartao
              titulo={fin ? "Inscrições validadas por mês" : "Receita confirmada por mês"}
              acoes={<span className="num text-[13px] text-tinta-suave">Últimos 12 meses · {fin ? `${num(total12)} inscrições` : eur(total12)}</span>}
              className="lg:col-span-2 relative z-10 overflow-visible"
            >
              <GraficoMensal
                serie={serie}
                formato={fin ? "num" : "eur"}
                rotulo={fin ? "Inscrições validadas nos últimos 12 meses" : "Receita confirmada nos últimos 12 meses"}
                tituloPorCurso={fin ? "Validadas por curso" : "Receita por curso"}
              />
              <p className="m-0 mt-3 text-xs text-tinta-suave">Passe o rato por um mês para comparar com o mês anterior ou com o mesmo mês do ano passado. Clique para fixar.</p>
            </Cartao>
            <CartaoATratar regime={regime} tarefas={p.aTratar} navigate={navigate} pode={pode} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <CartaoFunil regime={regime} funil={p.funil} />
            <CartaoConheceu regime={regime} conheceu={p.conheceu} />
            <CartaoProximas regime={regime} turmas={p.proximasTurmas} navigate={navigate} cronogramas={user.role === "comercial"} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <CartaoDesagregacao regime={regime} desag={p.desagregacao} onEixo={e => setF({ eixo: e })} />
            {!fin && p.metodos && p.porReceber && (
              <CartaoMetodos metodos={p.metodos} porReceber={p.porReceber} ticketMedio={p.ticketMedio} navigate={navigate} pode={pode} />
            )}
            {fin && (
              <Cartao titulo="Acesso rápido">
                <ul className="m-0 p-0 list-none flex flex-col gap-1 text-[13px]">
                  {([["fin-turmas", "Turmas financiadas"], ["fin-formandos", "Documentos dos formandos"], ["fin-dtp", "Dossiês TP"], ["fin-inscricoes", "Inscrições"]] as const).map(([v, r]) => (
                    <li key={v}>
                      <button type="button" onClick={() => navigate(v)} className="w-full text-left py-2 border-t border-linha-suave text-ligacao font-semibold hover:underline">{r}</button>
                    </li>
                  ))}
                </ul>
              </Cartao>
            )}
          </div>

          {fin && p.turmasEmCurso && p.assiduidadeMinima != null && (
            <TabelaTurmasEmCurso turmas={p.turmasEmCurso} minimo={p.assiduidadeMinima} navigate={navigate} />
          )}
        </div>
      )}
    </div>
  );
}
