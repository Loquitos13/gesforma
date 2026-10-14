// Regras de apresentação dos painéis: períodos, série mensal para o gráfico e destinos de navegação.
import type { MesPainel, RegimePainel } from "../../../partilhado/api/painel";
import type { EstatisticaMes, MesGrafico } from "../../../partilhado/ui";
import type { Destino, Vista } from "../../rotasGesforma";

export type PresetPeriodo = "mes" | "trimestre" | "ano" | "livre";

export const PRESETS: { id: PresetPeriodo; rotulo: string }[] = [
  { id: "mes", rotulo: "Este mês" },
  { id: "trimestre", rotulo: "Trimestre" },
  { id: "ano", rotulo: "Ano" },
  { id: "livre", rotulo: "Personalizado" },
];

const MESES_LONGOS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Datas do período escolhido. "Personalizado" usa as datas escritas (vazias = mês corrente no servidor). */
export function datasDoPeriodo(preset: PresetPeriodo, de: string, ate: string, hoje = new Date()) {
  const fim = iso(hoje);
  if (preset === "mes") return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), ate: fim };
  if (preset === "trimestre") return { de: iso(new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1)), ate: fim };
  if (preset === "ano") return { de: iso(new Date(hoje.getFullYear(), 0, 1)), ate: fim };
  return { de, ate };
}

/** Como se chama o período de comparação ("setembro", ou as datas). */
export function rotuloComparacao(preset: PresetPeriodo, anterior: { de: string; ate: string } | undefined) {
  if (!anterior) return "o período anterior";
  if (preset === "mes") return MESES_LONGOS[Number(anterior.ate.slice(5, 7)) - 1] ?? "o mês anterior";
  const curta = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(2, 4)}`;
  return `${curta(anterior.de)} a ${curta(anterior.ate)}`;
}

export function hojePorExtenso(hoje = new Date()) {
  const t = hoje.toLocaleDateString("pt-PT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const STATS: Record<RegimePainel, Omit<EstatisticaMes, "valor">[]> = {
  gold: [
    { id: "receita", rotulo: "Receita confirmada", formato: "eur" },
    { id: "pre", rotulo: "Pré-inscrições" },
    { id: "formandos", rotulo: "Novos formandos" },
    { id: "conversao", rotulo: "Conversão", formato: "pct", pp: true },
  ],
  fin: [
    { id: "validadas", rotulo: "Inscrições validadas" },
    { id: "pre", rotulo: "Pré-inscrições" },
    { id: "colocadas", rotulo: "Colocadas em turma" },
    { id: "taxa", rotulo: "Taxa de validação", formato: "pct", pp: true },
  ],
};

/** Série do servidor (24 meses) no formato do GraficoMensal. */
export function paraGrafico(regime: RegimePainel, serie: MesPainel[], hoje = new Date()): MesGrafico[] {
  const atual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  return serie.map(m => {
    const i = Number(m.chave.slice(5, 7)) - 1;
    return {
      chave: m.chave,
      curto: MESES_CURTOS[i] ?? m.chave,
      titulo: `${MESES_LONGOS[i] ?? ""} ${m.chave.slice(0, 4)}`.trim(),
      valor: m.valor,
      emCurso: m.chave === atual,
      stats: STATS[regime].map(s => ({ ...s, valor: m.stats.find(x => x.id === s.id)?.valor ?? 0 })),
      porCurso: m.porCurso,
      conheceu: m.conheceu,
    };
  });
}

/** Para onde leva cada indicador e cada fila de "a tratar hoje" (já com o filtro certo). */
export function destinoIndicador(regime: RegimePainel, id: string): Destino | null {
  const gold: Record<string, Destino> = {
    pre: { view: "gold-preinscricoes" },
    contactar: { view: "gold-preinscricoes", filtros: { fila: "contactar" } },
    formandos: { view: "gold-formandos-turmas" },
    receita: { view: "pagamentos", filtros: { situacao: "pago" } },
    turmas: { view: "gold-turmas", filtros: { fase: "decorrer" } },
  };
  const fin: Record<string, Destino> = {
    pre: { view: "fin-preinscricoes" },
    validadas: { view: "fin-inscricoes", filtros: { estado: "Elegível" } },
    emFormacao: { view: "fin-formandos" },
    assiduidade: { view: "fin-turmas", filtros: { fase: "decorrer" } },
    docsFalta: { view: "fin-formandos", filtros: { separador: "docs_em_falta" } },
    turmas: { view: "fin-turmas", filtros: { fase: "decorrer" } },
  };
  return (regime === "gold" ? gold : fin)[id] ?? null;
}

type Tarefa = { titulo: string; vista: Vista; tom: "perigo" | "aviso" | "neutro"; filtros?: Record<string, string> };

export const TAREFAS: Record<RegimePainel, Record<string, Tarefa>> = {
  gold: {
    contactar: { titulo: "Pré-inscrições por contactar", vista: "gold-preinscricoes", tom: "perigo", filtros: { fila: "contactar" } },
    documentos: { titulo: "Documentos a validar", vista: "gold-preinscricoes", tom: "aviso", filtros: { fila: "preinscricao" } },
    pedirPagamento: { titulo: "Pedir pagamento", vista: "gold-preinscricoes", tom: "aviso", filtros: { fila: "secretaria" } },
    comprovativos: { titulo: "Comprovativos a confirmar", vista: "pagamentos", tom: "aviso", filtros: { situacao: "a_confirmar" } },
    semFicha: { titulo: "Inscrever na turma", vista: "gold-preinscricoes", tom: "aviso", filtros: { fila: "converter" } },
    secretaria: { titulo: "Na secretaria", vista: "gold-preinscricoes", tom: "neutro", filtros: { fila: "secretaria" } },
  },
  fin: {
    contactar: { titulo: "Pré-inscrições por contactar", vista: "fin-preinscricoes", tom: "perigo", filtros: { fila: "contactar" } },
    documentos: { titulo: "Documentos a validar", vista: "fin-inscricoes", tom: "aviso", filtros: { estado: "Em análise" } },
    colocar: { titulo: "Colocar em turma", vista: "fin-inscricoes", tom: "aviso", filtros: { estado: "Elegível" } },
    iban: { titulo: "IBAN em falta", vista: "fin-formandos", tom: "perigo", filtros: { separador: "docs_em_falta" } },
    sumarios: { titulo: "Sumários e folhas por assinar", vista: "fin-turmas", tom: "aviso", filtros: { fase: "decorrer" } },
    dtp: { titulo: "Dossiês TP com bloqueantes", vista: "fin-dtp", tom: "perigo", filtros: { vista: "bloqueantes" } },
    apoios: { titulo: "Apoios por aprovar ou pagar", vista: "fin-turmas", tom: "aviso", filtros: { fase: "decorrer" } },
  },
};

export function destinoTarefa(regime: RegimePainel, id: string, leadId?: number | null): Destino | null {
  const t = TAREFAS[regime][id];
  if (!t) return null;
  if (leadId && (t.vista === "gold-preinscricoes" || t.vista === "fin-preinscricoes")) return { view: t.vista, leadId, filtros: t.filtros };
  return { view: t.vista, filtros: t.filtros };
}

/** Capacidade necessária para abrir cada vista a partir do painel (o servidor decide sempre). */
export function capacidadeDaVista(v: Vista): string | null {
  if (v === "pagamentos") return "pagamentos.ver";
  if (v.startsWith("fin-")) return "fin.ver";
  if (v.startsWith("gold-")) return "gold.ver";
  return null;
}
