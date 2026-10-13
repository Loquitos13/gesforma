export type SessaoCronograma = {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  modulos: string[];
  formadores: string[];
  modalidade?: "presencial" | "sincrona" | "auto" | "avaliacao" | "matricula";
};

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

/** Distribui os módulos da ficha do curso pelas sessões. Sem ficha, a sessão fica sem módulo. */
function moduloGerado(i: number, n: number, lista?: string[]) {
  if (!lista || !lista.length) return [];
  return [lista[Math.min(lista.length - 1, Math.floor((i * lista.length) / n))]!];
}

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
function pascoa(ano: number) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

/** Feriados nacionais obrigatórios em Portugal. */
export function feriadosNacionais(ano: number) {
  const fixos = ["01-01", "04-25", "05-01", "06-10", "08-15", "10-05", "11-01", "12-01", "12-08", "12-25"];
  const p = pascoa(ano);
  const desloc = (dias: number) => { const d = new Date(p); d.setDate(d.getDate() + dias); return toIso(d); };
  return new Set([...fixos.map(f => `${ano}-${f}`), desloc(-2), toIso(p), desloc(60)]);
}

function eFeriado(d: Date) {
  return feriadosNacionais(d.getFullYear()).has(toIso(d));
}

export function generateCronograma(opts: {
  inicio: string;
  horario: string;
  horas: number;
  formador: string;
  curso?: string;
  hoursPerSession?: number;
  modulos?: string[];
}): SessaoCronograma[] {
  const slot = horarioSlots(opts.horario);
  const hours = opts.hoursPerSession && opts.hoursPerSession > 0 ? opts.hoursPerSession : slot.hours;
  const end = opts.hoursPerSession && opts.hoursPerSession > 0 ? addHours(slot.start, hours) : slot.end;
  // Tantas sessões quantas as horas do curso pedem; a última encurta para fechar as horas certas.
  const totalHoras = opts.horas || 25;
  const n = Math.min(400, Math.max(1, Math.ceil(totalHoras / hours)));
  const ultimaHoras = totalHoras - hours * (n - 1);
  const cursor = parseIso(opts.inicio || "2026-09-07");
  const weekdays = slot.weekdays.length ? slot.weekdays : [cursor.getDay() || 3];
  for (let i = 0; i < 21; i++) {
    if (weekdays.includes(cursor.getDay()) && !eFeriado(cursor)) break;
    cursor.setDate(cursor.getDate() + 1);
  }
  const sessions: SessaoCronograma[] = [];
  for (let i = 0; i < n; i++) {
    sessions.push({
      id: `s-${opts.inicio || "new"}-${i + 1}`,
      data: toIso(cursor),
      horaInicio: slot.start,
      horaFim: i === n - 1 && ultimaHoras > 0 && ultimaHoras < hours ? addHours(slot.start, ultimaHoras) : end,
      modulos: moduloGerado(i, n, opts.modulos),
      formadores: opts.formador && opts.formador !== "A definir" ? [opts.formador] : [],
      modalidade: "presencial",
    });
    cursor.setDate(cursor.getDate() + 1);
    for (let j = 0; j < 21; j++) {
      if (weekdays.includes(cursor.getDay()) && !eFeriado(cursor)) break;
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return sessions;
}
