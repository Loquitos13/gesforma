/**
 * Monta a resposta de `GET /v1/painel/:regime` a partir das consultas de
 * `estatisticas.ts`, `painelBlocos.ts` e `painelFin.ts`.
 */
import type { Db } from "../db/pool.js";
import {
  contarFormandosGold, contarLeads, contarValidadas, formandosGoldPorMes, leadsPorMes, mesesDaJanela,
  porContactar, receitaPorMes, somarReceita, turmasADecorrer, validadasPorMes, type FiltroPainel, type LinhaMes,
} from "./estatisticas.js";
import {
  conheceu, desagregacao, funil, metodosPagamento, proximasTurmas, tarefasFin, tarefasGold, type Eixo, type Tarefa,
} from "./painelBlocos.js";
import { apoiosPendentes } from "./apoios.js";
import { turmasFinEmCurso } from "./painelFin.js";
import type { Regime } from "./sql.js";
import { rotuloCodigoCurso } from "../../../src/partilhado/codigoCurso.js";

export type Indicador = {
  id: string;
  rotulo: string;
  valor: number | null;
  /** Valor no período anterior equivalente (null quando o indicador é um estado actual). */
  anterior: number | null;
  formato: "num" | "eur" | "pct";
  /** Comparar em pontos percentuais. */
  pp?: boolean;
  /** Descer é bom. */
  inverso?: boolean;
  /** Linha de contexto quando não há comparação. */
  nota?: string;
  tom?: "perigo" | "aviso" | "neutro";
};

export type MesSerie = {
  chave: string;
  valor: number;
  stats: { id: string; valor: number }[];
  porCurso: { nome: string; valor: number }[];
  conheceu: { rotulo: string; n: number }[];
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0);

/** Agrupa as linhas por mês: total (chave null) e detalhe (chave preenchida). */
function porMes(linhas: LinhaMes[]) {
  const total = new Map<string, LinhaMes>();
  const detalhe = new Map<string, LinhaMes[]>();
  for (const l of linhas) {
    if (l.chave == null) total.set(l.mes, l);
    else detalhe.set(l.mes, [...(detalhe.get(l.mes) ?? []), l]);
  }
  return { total, detalhe };
}

async function serieGold(db: Db, f: FiltroPainel): Promise<MesSerie[]> {
  const [receita, leads, formandos] = await Promise.all([receitaPorMes(db, f), leadsPorMes(db, f), formandosGoldPorMes(db, f)]);
  const r = porMes(receita);
  const l = porMes(leads);
  const fo = new Map(formandos.map(x => [x.mes, x.n]));
  return mesesDaJanela(f.ate).map(chave => {
    const pre = l.total.get(chave)?.n ?? 0;
    const novos = fo.get(chave) ?? 0;
    const valor = Math.round(r.total.get(chave)?.v ?? 0);
    return {
      chave,
      valor,
      stats: [
        { id: "receita", valor },
        { id: "pre", valor: pre },
        { id: "formandos", valor: novos },
        { id: "conversao", valor: pct(novos, pre) },
      ],
      porCurso: (r.detalhe.get(chave) ?? []).sort((a, b) => b.v - a.v).map(x => ({ nome: x.chave!, valor: Math.round(x.v) })),
      conheceu: (l.detalhe.get(chave) ?? []).sort((a, b) => b.n - a.n).map(x => ({ rotulo: x.chave!, n: x.n })),
    };
  });
}

async function serieFin(db: Db, f: FiltroPainel): Promise<MesSerie[]> {
  const [validadas, leads] = await Promise.all([validadasPorMes(db, f), leadsPorMes(db, f)]);
  const total = new Map(validadas.filter(v => v.chave == null).map(v => [v.mes, v]));
  const cursos = new Map<string, typeof validadas>();
  for (const v of validadas) if (v.chave != null) cursos.set(v.mes, [...(cursos.get(v.mes) ?? []), v]);
  const l = porMes(leads);
  return mesesDaJanela(f.ate).map(chave => {
    const pre = l.total.get(chave)?.n ?? 0;
    const val = total.get(chave)?.n ?? 0;
    return {
      chave,
      valor: val,
      stats: [
        { id: "validadas", valor: val },
        { id: "pre", valor: pre },
        { id: "colocadas", valor: total.get(chave)?.colocadas ?? 0 },
        { id: "taxa", valor: pct(val, pre) },
      ],
      porCurso: (cursos.get(chave) ?? []).sort((a, b) => b.n - a.n).map(x => ({ nome: x.chave!, valor: x.n })),
      conheceu: (l.detalhe.get(chave) ?? []).sort((a, b) => b.n - a.n).map(x => ({ rotulo: x.chave!, n: x.n })),
    };
  });
}

export async function montarPainel(db: Db, f: FiltroPainel, eixo: Eixo) {
  const fin = f.regime === "fin";
  const [leads, contactar, turmas, serie, funis, origens, proximas, desag] = await Promise.all([
    contarLeads(db, f), porContactar(db, f), turmasADecorrer(db, f),
    fin ? serieFin(db, f) : serieGold(db, f),
    funil(db, f), conheceu(db, f), proximasTurmas(db, f), desagregacao(db, f, eixo),
  ]);
  const tarefaContactar: Tarefa = {
    id: "contactar",
    n: contactar.n,
    detalhe: contactar.n ? `A mais antiga entrou há ${contactar.maisAntigaDias} dia${contactar.maisAntigaDias === 1 ? "" : "s"}` : "Fila em dia",
    leadId: contactar.leadId,
  };
  const turmasNota = turmas.comecamEsteMes ? `${turmas.comecamEsteMes} começam este mês` : "Nenhuma começa este mês";
  const comum = { regime: f.regime as Regime, periodo: { de: f.de, ate: f.ate, anterior: f.anterior }, serie, funil: funis, conheceu: origens, proximasTurmas: proximas, desagregacao: { eixo, linhas: desag } };

  if (fin) {
    const [validadas, filas, emCurso, apoios] = await Promise.all([contarValidadas(db, f), tarefasFin(db, f), turmasFinEmCurso(db, f), apoiosPendentes(db)]);
    const incompletos = filas.find(t => t.id === "incompletos")?.n ?? 0;
    const kpis: Indicador[] = [
      { id: "pre", rotulo: "Pré-inscrições", valor: leads.atual, anterior: leads.anterior, formato: "num" },
      { id: "validadas", rotulo: "Inscrições validadas", valor: validadas.atual, anterior: validadas.anterior, formato: "num" },
      { id: "emFormacao", rotulo: "Formandos em formação", valor: emCurso.emFormacao, anterior: null, formato: "num", nota: `${emCurso.linhas.length} turma${emCurso.linhas.length === 1 ? "" : "s"} a decorrer` },
      { id: "assiduidade", rotulo: "Assiduidade média", valor: emCurso.assiduidadeMedia, anterior: null, formato: "pct", nota: emCurso.abaixoMinimo ? `${emCurso.abaixoMinimo} abaixo de ${emCurso.minimo} %` : `Todos acima de ${emCurso.minimo} %`, tom: emCurso.abaixoMinimo ? "aviso" : "neutro" },
      { id: "docsFalta", rotulo: "Documentos em falta", valor: incompletos, anterior: null, formato: "num", inverso: true, nota: "Formandos sem os obrigatórios todos", tom: incompletos ? "perigo" : "neutro" },
      { id: "turmas", rotulo: "Turmas a decorrer", valor: turmas.decorrer, anterior: null, formato: "num", nota: turmasNota },
    ];
    const resumo = (lista: { nome: string; ufcd: string; dtpPct: number }[], comPct: boolean) =>
      lista.length ? `${lista[0]!.ufcd ? `${rotuloCodigoCurso(lista[0]!.ufcd)} · ` : ""}${lista[0]!.nome}${comPct ? ` a ${lista[0]!.dtpPct} %` : ""}${lista.length > 1 ? ` e mais ${lista.length - 1}` : ""}` : "Nada pendente";
    const aTratar: Tarefa[] = [
      tarefaContactar,
      ...filas.filter(t => t.id !== "incompletos"),
      { id: "sumarios", n: emCurso.sessoesPorAssinar, detalhe: resumo(emCurso.turmasPorAssinar, false) },
      { id: "dtp", n: emCurso.comBloqueantes.length, detalhe: resumo([...emCurso.comBloqueantes].sort((a, b) => a.dtpPct - b.dtpPct), true) },
      {
        id: "apoios",
        n: apoios.calculados + apoios.aprovados,
        detalhe: apoios.calculados + apoios.aprovados
          ? `${apoios.calculados} por aprovar · ${apoios.aprovados} por pagar`
          : "Nada pendente",
      },
    ];
    return { ...comum, kpis, aTratar, turmasEmCurso: emCurso.linhas, assiduidadeMinima: emCurso.minimo, metodos: null, porReceber: null };
  }

  const [formandos, receita, filas, pagamentos] = await Promise.all([
    contarFormandosGold(db, f), somarReceita(db, f), tarefasGold(db, f), metodosPagamento(db, f),
  ]);
  const kpis: Indicador[] = [
    { id: "pre", rotulo: "Pré-inscrições", valor: leads.atual, anterior: leads.anterior, formato: "num" },
    { id: "contactar", rotulo: "Por contactar", valor: contactar.n, anterior: null, formato: "num", inverso: true, nota: contactar.atrasados ? `${contactar.atrasados} com contacto atrasado` : "Nenhum atrasado", tom: contactar.atrasados ? "perigo" : "neutro" },
    { id: "formandos", rotulo: "Novos formandos", valor: formandos.atual, anterior: formandos.anterior, formato: "num" },
    { id: "conversao", rotulo: "Conversão", valor: pct(formandos.atual, leads.atual), anterior: pct(formandos.anterior, leads.anterior), formato: "pct", pp: true },
    { id: "receita", rotulo: "Receita confirmada", valor: Math.round(receita.atual), anterior: Math.round(receita.anterior), formato: "eur" },
    { id: "turmas", rotulo: "Turmas a decorrer", valor: turmas.decorrer, anterior: null, formato: "num", nota: turmasNota },
  ];
  return {
    ...comum,
    kpis,
    aTratar: [tarefaContactar, ...filas],
    turmasEmCurso: null,
    assiduidadeMinima: null,
    metodos: pagamentos.metodos,
    porReceber: pagamentos.porReceber,
    ticketMedio: receita.pagos ? Math.round(receita.atual / receita.pagos) : 0,
  };
}
