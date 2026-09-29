export type SessaoCronograma = {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  modulos: string[];
  formadores: string[];
  modalidade?: "presencial" | "sincrona" | "auto" | "avaliacao" | "matricula";
};

const CCP_MODULOS = [
  "M1 · Formador: sistemas, contextos e perfil",
  "M2 · Simulação pedagógica inicial",
  "M3 · Comunicação e dinamização de grupos",
  "M4 · Metodologias e estratégias pedagógicas",
  "M5 · Operacionalização da formação",
  "M6 · Recursos didáticos e multimédia",
  "M7 · Plataformas colaborativas e de aprendizagem",
  "M8 · Avaliação da formação e das aprendizagens",
  "M9 · Simulação pedagógica final",
];

const UFCD_3564_MODULOS = [
  "UFCD 3564 · Avaliação primária e SVB",
  "UFCD 3564 · Trauma e hemorragias",
  "UFCD 3564 · Queimaduras e intoxicações",
  "UFCD 3564 · Emergências médicas",
  "UFCD 3564 · Simulação e avaliação",
];

function addHours(start: string, hours: number) {
  const [h, m] = start.split(":").map(Number);
  const total = (h || 0) * 60 + (m || 0) + Math.round(hours * 60);
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

function horarioSlots(horario: string) {
  if (horario === "Sábado manhã") return { start: "09:00", end: "13:00", hours: 4, weekdays: [6] };
  if (horario === "Pós Laboral" || horario === "Pós-Laboral") return { start: "19:00", end: "22:00", hours: 3, weekdays: [1, 2, 3, 4] };
  if (horario === "Laboral Manhã" || horario === "Laboral manhã") return { start: "09:00", end: "13:00", hours: 4, weekdays: [1, 2, 3, 4, 5] };
  if (horario === "Laboral Tarde" || horario === "Laboral tarde") return { start: "14:00", end: "18:00", hours: 4, weekdays: [1, 2, 3, 4, 5] };
  return { start: "19:00", end: "22:00", hours: 3, weekdays: [] as number[] };
}

function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1);
}

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function modulosForIndex(i: number, n: number, curso?: string) {
  const pool = curso?.includes("Primeiros Socorros") || curso?.includes("3564") ? UFCD_3564_MODULOS : CCP_MODULOS;
  return [pool[Math.min(pool.length - 1, Math.floor((i * pool.length) / n))] ?? pool[0]!];
}

/** Mesmo plano de sessões que o cockpit desenha - a base guarda o cronograma real da turma. */
export function generateCronograma(opts: {
  inicio: string;
  horario: string;
  horas: number;
  formador: string;
  curso?: string;
  hoursPerSession?: number;
}): SessaoCronograma[] {
  const slot = horarioSlots(opts.horario);
  const hours = opts.hoursPerSession && opts.hoursPerSession > 0 ? opts.hoursPerSession : slot.hours;
  const end = opts.hoursPerSession && opts.hoursPerSession > 0 ? addHours(slot.start, hours) : slot.end;
  const n = Math.min(24, Math.max(4, Math.ceil((opts.horas || 25) / hours)));
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
      horaFim: end,
      modulos: modulosForIndex(i, n, opts.curso),
      formadores: opts.formador && opts.formador !== "A definir" ? [opts.formador] : [],
      modalidade: "presencial",
    });
    cursor.setDate(cursor.getDate() + 1);
    for (let j = 0; j < 14; j++) {
      if (weekdays.includes(cursor.getDay())) break;
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return sessions;
}
