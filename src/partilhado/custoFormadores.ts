// Custo dos formadores de uma turma: as horas de cada um no cronograma × o valor por hora desta turma
// (vazio, vale o custo por hora da ficha do formador). Partilhado entre o cartão «Custos da turma» da visão
// geral (browser) e as despesas automáticas dos formadores da Financiada (servidor): dão sempre os mesmos números.

type SessaoCusto = { modalidade?: unknown; formadores?: unknown; formador?: unknown; horaInicio?: unknown; horaFim?: unknown };

export const arred2 = (v: number) => Math.round(v * 100) / 100;

const sessoesDe = (cronograma: unknown): SessaoCusto[] =>
  (Array.isArray(cronograma) ? cronograma : []).filter((s): s is SessaoCusto => Boolean(s) && typeof s === "object");

/** Só as sessões lectivas (presencial e síncrona) contam horas de formador. */
function lectiva(s: SessaoCusto) {
  const m = s.modalidade ?? "presencial";
  return m === "presencial" || m === "sincrona";
}

/** Os formadores da sessão (a lista, ou o campo antigo `formador`). */
export function formadoresDaSessao(s: SessaoCusto): string[] {
  if (Array.isArray(s.formadores) && s.formadores.length) {
    return s.formadores.filter((f): f is string => typeof f === "string").map(f => f.trim()).filter(Boolean);
  }
  return typeof s.formador === "string" && s.formador.trim() ? [s.formador.trim()] : [];
}

function minutos(h: unknown) {
  const [hh, mm] = (typeof h === "string" && h ? h : "00:00").split(":").map(Number);
  const m = (hh ?? 0) * 60 + (mm ?? 0);
  return Number.isFinite(m) ? m : 0;
}

/** Horas lectivas do formador no cronograma (uma casa decimal). */
export function horasDoFormadorNoCronograma(cronograma: unknown, nome: string) {
  const alvo = nome.trim().toLowerCase();
  const total = sessoesDe(cronograma).reduce((acc, s) => {
    if (!lectiva(s) || !formadoresDaSessao(s).some(f => f.toLowerCase() === alvo)) return acc;
    return acc + Math.max(0, (minutos(s.horaFim) - minutos(s.horaInicio)) / 60);
  }, 0);
  return Math.round(total * 10) / 10;
}

export type TurmaComFormadores = {
  formador?: string | null;
  formadores?: readonly unknown[] | null;
  cronograma: unknown;
  valoresHoraFormador?: Record<string, number> | null;
};

/** Os formadores da turma: o responsável, a equipa e os das sessões (sem repetir, a primeira grafia fica). */
export function nomesFormadoresTurma(t: TurmaComFormadores): string[] {
  const nomes = new Map<string, string>();
  const juntar = (n: unknown) => {
    const s = typeof n === "string" ? n.trim() : "";
    if (s && !nomes.has(s.toLowerCase())) nomes.set(s.toLowerCase(), s);
  };
  juntar(t.formador);
  for (const n of t.formadores ?? []) juntar(n);
  for (const s of sessoesDe(t.cronograma)) for (const n of formadoresDaSessao(s)) juntar(n);
  return [...nomes.values()];
}

/** O valor por hora próprio desta turma (a chave como foi gravada; sem ela, ignorando maiúsculas). */
export function valorHoraDaTurma(valores: Record<string, number> | null | undefined, nome: string): number | null {
  const v = valores ?? {};
  if (typeof v[nome] === "number") return v[nome]!;
  const alvo = nome.trim().toLowerCase();
  const chave = Object.keys(v).find(k => k.trim().toLowerCase() === alvo);
  return chave !== undefined && typeof v[chave] === "number" ? v[chave]! : null;
}

export type LinhaCustoFormador = {
  nome: string;
  horas: number;
  /** Custo por hora da ficha do formador. */
  daFicha: number;
  /** Valor por hora desta turma (null = vale o da ficha). */
  proprio: number | null;
  valorHora: number;
  total: number;
};

/** Uma linha por formador da turma: horas × valor por hora = total (arredondado ao cêntimo). */
export function custosFormadores(t: TurmaComFormadores, custoDaFicha: (nome: string) => number): LinhaCustoFormador[] {
  return nomesFormadoresTurma(t).map(nome => {
    const horas = horasDoFormadorNoCronograma(t.cronograma, nome);
    const daFicha = custoDaFicha(nome) || 0;
    const proprio = valorHoraDaTurma(t.valoresHoraFormador, nome);
    const valorHora = proprio ?? daFicha;
    return { nome, horas, daFicha, proprio, valorHora, total: arred2(horas * valorHora) };
  });
}
