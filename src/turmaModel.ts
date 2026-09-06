import type { SelectOption } from "./FormKit";
import type { SessaoMeta } from "./TurmaExtras";

export type SessaoCronograma = {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  modulo: string;
  formador: string;
};

export type TurmaGold = {
  id: number;
  dataInicio: string;
  nome: string;
  curso: string;
  local: string;
  horario: string;
  totalAlunos: number;
  vagas: number;
  estado: "Ativa" | "Inativa";
  formador: string;
  horas: number;
  cronograma: SessaoCronograma[];
};

export type TurmaFin = {
  id: number;
  dataInicio: string;
  nome: string;
  curso: string;
  ufcdCod: string;
  local: string;
  horario: string;
  alunos: number;
  alunosTotal: number;
  estado: string;
  horas: number;
  formador: string;
  activa: boolean;
  cronograma: SessaoCronograma[];
};

const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const CCP_MODULOS = [
  "Módulo 1 - Fundamentos da Formação Profissional",
  "Módulo 2 - Planeamento e Organização da Formação",
  "Módulo 3 - Comunicação e Dinamização de Grupos",
  "Módulo 4 - Avaliação das Aprendizagens",
  "Módulo 5 - Elaboração do Portefólio",
];

export function isTurmaActiva(t: { estado?: string; activa?: boolean }) {
  if (typeof t.activa === "boolean") return t.activa;
  return t.estado === "Ativa" || t.estado === "Ativo";
}

export function formatSessaoLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS_PT[dt.getDay()]}, ${String(d).padStart(2, "0")} ${MONTHS_PT[m - 1]} ${y}`;
}

function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1);
}

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function horarioSlots(horario: string) {
  if (horario === "Sábado manhã") return { start: "09:00", end: "13:00", hours: 4, weekdays: [6] };
  if (horario === "Pós Laboral") return { start: "19:00", end: "22:00", hours: 3, weekdays: [1, 2, 3, 4] };
  if (horario === "Laboral Manhã") return { start: "09:00", end: "13:00", hours: 4, weekdays: [1, 2, 3, 4, 5] };
  return { start: "19:00", end: "22:00", hours: 3, weekdays: [] as number[] };
}

function durationLabel(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  const h = Math.max(1, Math.round(mins / 60));
  return `${h}h`;
}

function moduloForIndex(i: number, n: number, curso?: string) {
  if (curso?.includes("Primeiros Socorros") || curso?.includes("3564")) {
    const blocos = ["Avaliação primária e SVB", "Trauma e hemorragias", "Queimaduras e intoxicações", "Emergências médicas", "Simulação e avaliação"];
    return `UFCD 3564 · ${blocos[Math.min(blocos.length - 1, Math.floor((i * blocos.length) / n))]}`;
  }
  return CCP_MODULOS[Math.min(CCP_MODULOS.length - 1, Math.floor((i * CCP_MODULOS.length) / n))];
}

export function generateCronograma(opts: {
  inicio: string;
  horario: string;
  horas: number;
  formador: string;
  curso?: string;
}): SessaoCronograma[] {
  const slot = horarioSlots(opts.horario);
  const n = Math.min(16, Math.max(4, Math.ceil((opts.horas || 25) / slot.hours)));
  const cursor = parseIso(opts.inicio || "2026-09-07");
  const weekdays = slot.weekdays.length ? slot.weekdays : [cursor.getDay() || 3];
  for (let i = 0; i < 7; i++) {
    if (weekdays.includes(cursor.getDay())) break;
    cursor.setDate(cursor.getDate() + 1);
  }
  const sessions: SessaoCronograma[] = [];
  for (let i = 0; i < n; i++) {
    sessions.push({
        id: `s-${opts.inicio || "new"}-${i + 1}`,
      data: toIso(cursor),
      horaInicio: slot.start,
      horaFim: slot.end,
      modulo: moduloForIndex(i, n, opts.curso),
      formador: opts.formador || "A definir",
    });
    cursor.setDate(cursor.getDate() + 1);
    for (let j = 0; j < 14; j++) {
      if (weekdays.includes(cursor.getDay())) break;
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return sessions;
}

export function emptySessao(formador = "A definir"): SessaoCronograma {
  return {
    id: `s-new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    data: "",
    horaInicio: "09:00",
    horaFim: "13:00",
    modulo: "",
    formador,
  };
}

export function horasCronograma(sessoes: SessaoCronograma[]) {
  return sessoes.reduce((acc, s) => {
    const [sh, sm] = (s.horaInicio || "00:00").split(":").map(Number);
    const [eh, em] = (s.horaFim || "00:00").split(":").map(Number);
    return acc + Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60);
  }, 0);
}

export function cronogramaToSessoes(c: SessaoCronograma[], today = "2026-09-06"): SessaoMeta[] {
  return c.map((s, i) => ({
    n: i + 1,
    data: formatSessaoLabel(s.data),
    hora: `${(s.horaInicio || "").replace(":", "h")}–${(s.horaFim || "").replace(":", "h")}`,
    formador: s.formador,
    estado: s.data && s.data < today ? "Realizada" : "Agendada",
    plano: Boolean(s.data && s.data < today),
    modulo: s.modulo,
    duracao: durationLabel(s.horaInicio || "09:00", s.horaFim || "13:00"),
  }));
}

export function turmaGoldOpts(
  turmas: TurmaGold[],
  opts?: { curso?: string; includeNome?: string },
): SelectOption[] {
  return turmas
    .filter(t => {
      if (opts?.curso && t.curso !== opts.curso) return false;
      if (isTurmaActiva(t)) return true;
      return Boolean(opts?.includeNome && t.nome === opts.includeNome);
    })
    .map(t => ({
      value: t.nome,
      sub: isTurmaActiva(t)
        ? `${t.local} · ${t.horario} · ${Math.max(0, t.vagas - t.totalAlunos)} vagas`
        : `${t.local} · Inativa — não aceita novas inscrições`,
    }));
}

export function turmaFinOpts(
  turmas: TurmaFin[],
  opts?: { curso?: string; includeNome?: string },
): SelectOption[] {
  return turmas
    .filter(t => {
      if (opts?.curso && t.curso !== opts.curso && !t.nome.includes(opts.curso)) return false;
      if (isTurmaActiva(t)) return true;
      return Boolean(opts?.includeNome && t.nome === opts.includeNome);
    })
    .map(t => ({
      value: t.nome,
      sub: isTurmaActiva(t)
        ? `UFCD ${t.ufcdCod} · ${t.alunos}/${t.alunosTotal} inscritos`
        : `UFCD ${t.ufcdCod} · Inativa — não aceita novas inscrições`,
    }));
}

export const GOLD_TURMAS_SEED: Omit<TurmaGold, "cronograma" | "formador" | "horas" | "estado">[] = [
  { id: 947, dataInicio: "2026-09-03", nome: "2176/2026", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Laboral Manhã", totalAlunos: 16, vagas: 16 },
  { id: 946, dataInicio: "2026-07-06", nome: "IRN LSB 01/09", curso: "Formação de Formadores - CCP", local: "Lisboa", horario: "Laboral Manhã", totalAlunos: 12, vagas: 16 },
  { id: 945, dataInicio: "2026-09-15", nome: "BRG-PL-15/09", curso: "Formação de Formadores - CCP", local: "Braga", horario: "Pós Laboral", totalAlunos: 2, vagas: 16 },
  { id: 944, dataInicio: "2026-09-21", nome: "BRG-SM-21/09", curso: "Formação de Formadores - CCP", local: "Braga", horario: "Sábado manhã", totalAlunos: 6, vagas: 16 },
  { id: 943, dataInicio: "2026-09-07", nome: "VNG-SM-07/09", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Sábado manhã", totalAlunos: 10, vagas: 16 },
  { id: 940, dataInicio: "2026-09-03", nome: "2175/2026", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Laboral Manhã", totalAlunos: 14, vagas: 16 },
  { id: 939, dataInicio: "2026-09-04", nome: "VNG-PL-04/09", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Pós Laboral", totalAlunos: 9, vagas: 16 },
  { id: 938, dataInicio: "2026-09-02", nome: "PEN-SM-02/09", curso: "Formação de Formadores - CCP", local: "Penafiel", horario: "Sábado manhã", totalAlunos: 13, vagas: 16 },
  { id: 937, dataInicio: "2026-08-28", nome: "VNG-SM-28/08", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Sábado manhã", totalAlunos: 12, vagas: 16 },
  { id: 936, dataInicio: "2026-09-03", nome: "VNG-LM-03/09", curso: "Formação de Formadores - CCP", local: "V.N.Gaia", horario: "Laboral Manhã", totalAlunos: 12, vagas: 16 },
];

const GOLD_INATIVAS = new Set([937, 936]);

export function seedGoldTurmas(): TurmaGold[] {
  return GOLD_TURMAS_SEED.map(t => ({
    ...t,
    estado: GOLD_INATIVAS.has(t.id) ? "Inativa" : "Ativa",
    formador: "Isac Silva",
    horas: 90,
    cronograma: generateCronograma({
      inicio: t.dataInicio,
      horario: t.horario,
      horas: 90,
      formador: "Isac Silva",
      curso: t.curso,
    }),
  }));
}

export const FIN_TURMAS_SEED: Omit<TurmaFin, "cronograma" | "activa">[] = [
  { id: 222, dataInicio: "2026-09-18", nome: "UFCD 9109 - Cuidados Básicos", curso: "Masterclass em Estética Facial", ufcdCod: "9109", local: "Sala Virtual / E-Learning", horario: "Online", alunos: 1, alunosTotal: 20, estado: "A montar", horas: 25, formador: "Cátia" },
  { id: 220, dataInicio: "2026-07-31", nome: "UC02282 - Criar campanhas", curso: "Publicidade nas Redes Sociais", ufcdCod: "10785", local: "Sala Virtual / E-Learning", horario: "Online", alunos: 17, alunosTotal: 20, estado: "A montar", horas: 25, formador: "Isac" },
  { id: 219, dataInicio: "2026-08-31", nome: "UCUC00033 - Comunicar", curso: "Comunicar e interagir em contexto profissional", ufcdCod: "3564", local: "Sala Virtual / E-Learning", horario: "Online", alunos: 17, alunosTotal: 20, estado: "A decorrer", horas: 25, formador: "António" },
  { id: 218, dataInicio: "2026-08-27", nome: "UFCD 3564 - Primeiros So.", curso: "Primeiros Socorros", ufcdCod: "3564", local: "Sala Virtual / E-Learning", horario: "Online", alunos: 4, alunosTotal: 20, estado: "A montar", horas: 25, formador: "Vânia Fernandes" },
  { id: 217, dataInicio: "2026-08-27", nome: "UFCD 9119 - Massagem", curso: "Técnicas de massagem", ufcdCod: "9119", local: "Sala Virtual / E-Learning", horario: "Online", alunos: 17, alunosTotal: 20, estado: "A decorrer", horas: 25, formador: "Rosana" },
];

export function seedFinTurmas(): TurmaFin[] {
  return FIN_TURMAS_SEED.map(t => ({
    ...t,
    activa: t.id !== 222,
    cronograma: generateCronograma({
      inicio: t.dataInicio,
      horario: t.horario === "Online" ? "Pós Laboral" : t.horario,
      horas: t.horas,
      formador: t.formador,
      curso: t.curso,
    }),
  }));
}
