import type { SessaoMeta } from "./TurmaExtras";

export type SessaoModalidade = "presencial" | "sincrona" | "auto" | "avaliacao" | "matricula";

export type SessaoCronograma = {
  id: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  modulos: string[];
  formadores: string[];
  modalidade?: SessaoModalidade;
  iniciadaEm?: string;
  fechadaEm?: string;
};

export function sessaoModalidade(s: Pick<SessaoCronograma, "modalidade">): SessaoModalidade {
  return s.modalidade ?? "presencial";
}

export function isSessaoLectiva(s: Pick<SessaoCronograma, "modalidade">) {
  const m = sessaoModalidade(s);
  return m === "presencial" || m === "sincrona";
}

export function codigoModulo(nome: string) {
  const raw = nome.trim();
  const tagged = raw.match(/^(M\d+|C\d+|UFCD\s*\d+|EX\d+|AV\d+)/i);
  if (tagged) return tagged[1].replace(/\s+/g, " ");
  const before = raw.split("·")[0]?.trim();
  return before || raw;
}

function chaveModulo(nome: string) {
  return nome.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * O mesmo módulo aparece escrito de maneiras diferentes conforme a origem: o
 * catálogo da base ("M1 · Aprendizagem e pedagogia"), o catálogo do formulário
 * ("M1 · Formador: sistemas, contextos e perfil") e cronogramas antigos. O
 * código é a única parte estável, mas há cursos onde vários módulos partilham
 * o mesmo código (UFCD 3564), por isso só serve quando é único na lista.
 */
export function casarModulo(valor: string, opcoes: string[]): string | null {
  const alvo = chaveModulo(valor);
  if (!alvo) return null;
  const exacto = opcoes.find(o => chaveModulo(o) === alvo);
  if (exacto) return exacto;
  const codigo = codigoModulo(valor).toLowerCase();
  if (!codigo) return null;
  const mesmoCodigo = opcoes.filter(o => codigoModulo(o).toLowerCase() === codigo);
  return mesmoCodigo.length === 1 ? mesmoCodigo[0]! : null;
}

export function ordenarCodigos(codes: string[]) {
  const n = (code: string) => Number(code.match(/(\d+)/)?.[1] ?? 9999);
  return [...new Set(codes.filter(Boolean))].sort((a, b) => n(a) - n(b) || a.localeCompare(b, "pt"));
}

export function ordenarModulos(modulos: string[]) {
  const n = (nome: string) => Number(codigoModulo(nome).match(/(\d+)/)?.[1] ?? 9999);
  return [...modulos].sort((a, b) => n(a) - n(b) || codigoModulo(a).localeCompare(codigoModulo(b), "pt"));
}

export function codigosModulos(modulos: string[] | undefined) {
  return ordenarCodigos((modulos ?? []).map(codigoModulo).filter(Boolean)).join("/");
}

export function lugaresLivres(t: {
  vagas?: number;
  totalAlunos?: number;
  alunos?: number;
  alunosTotal?: number;
  toleranciaVagas?: number;
}) {
  const limite = (t.vagas ?? t.alunosTotal ?? 0) + Math.max(0, t.toleranciaVagas ?? 0);
  const ocupados = t.totalAlunos ?? t.alunos ?? 0;
  return limite - ocupados;
}

export function modulosLabel(modulos: string[] | undefined, empty = "Módulo por definir") {
  const list = (modulos ?? []).map(m => m.trim()).filter(Boolean);
  return list.length ? list.join(" · ") : empty;
}

export function sessaoModulos(s: { modulos?: string[]; modulo?: string }) {
  if (s.modulos?.length) return s.modulos.filter(Boolean);
  return s.modulo ? [s.modulo] : [];
}

export function sessaoFormadores(s: { formadores?: string[]; formador?: string }) {
  if (s.formadores?.length) return s.formadores.map(f => f.trim()).filter(Boolean);
  return s.formador?.trim() ? [s.formador.trim()] : [];
}

export function formadoresLabel(formadores: string[] | undefined, empty = "Formador por definir") {
  const list = (formadores ?? []).map(f => f.trim()).filter(Boolean);
  return list.length ? list.join(" · ") : empty;
}

export function formadoresNasSessoes(
  sessoes: { formadores?: string[]; formador?: string }[],
  fallback?: string,
) {
  const counts = new Map<string, number>();
  for (const s of sessoes) {
    for (const nome of sessaoFormadores(s)) {
      if (!nome || nome === "A definir") continue;
      counts.set(nome, (counts.get(nome) ?? 0) + 1);
    }
  }
  if (counts.size === 0 && fallback?.trim()) {
    for (const nome of fallback.split("·").map(s => s.trim()).filter(Boolean)) counts.set(nome, 0);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"))
    .map(([nome, sessoesN]) => ({ nome, sessoes: sessoesN }));
}

export type TurmaGold = {
  id: number;
  dataInicio: string;
  nome: string;
  curso: string;
  local: string;
  horario: string;
  totalAlunos: number;
  vagas: number;
  inscricoesAdicionais?: number;
  toleranciaVagas?: number;
  vagasAnunciadas?: number | null;
  estado: "Ativa" | "Inativa";
  formador: string;
  formadores?: string[];
  horas: number;
  custoHoraSala?: number;
  valoresHoraFormador?: Record<string, number>;
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
  inscricoesAdicionais?: number;
  toleranciaVagas?: number;
  estado: string;
  horas: number;
  formador: string;
  formadores?: string[];
  valoresHoraFormador?: Record<string, number>;
  activa: boolean;
  fechadaEm?: string;
  fechadaPor?: string;
  cronograma: SessaoCronograma[];
};

const WEEKDAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function isTurmaActiva(t: { estado?: string; activa?: boolean }) {
  if (typeof t.activa === "boolean") return t.activa;
  return t.estado === "Ativa" || t.estado === "Ativo";
}

/** Dia civil do calendário, independente do fuso do browser. */
export function hojeIso(agora = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(agora);
  const p = (tipo: Intl.DateTimeFormatPartTypes) => parts.find(x => x.type === tipo)?.value ?? "";
  return `${p("year")}-${p("month")}-${p("day")}`;
}

export function horaAgora(agora = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(agora);
  const p = (tipo: Intl.DateTimeFormatPartTypes) => parts.find(x => x.type === tipo)?.value ?? "";
  return `${p("hour")}:${p("minute")}`;
}

const MONTHS_FULL_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export type SessaoEstado = "realizada" | "hoje" | "proxima" | "agendada" | "por-agendar";

export function formatSessaoLabel(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS_PT[dt.getDay()]}, ${String(d).padStart(2, "0")} ${MONTHS_PT[m - 1]} ${y}`;
}

export function weekdayShort(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "-";
  return WEEKDAYS_PT[new Date(y, m - 1, d).getDay()];
}

export function formatDiaMes(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "Sem data";
  return `${String(d).padStart(2, "0")} ${MONTHS_PT[m - 1]}`;
}

export function formatMesAno(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  if (!y || !m) return "Por agendar";
  return `${MONTHS_FULL_PT[m - 1]} ${y}`;
}

export function formatHoraRange(inicio: string, fim: string) {
  const a = (inicio || "").replace(":", "h");
  const b = (fim || "").replace(":", "h");
  if (!a && !b) return "Horário por definir";
  return `${a} a ${b}`;
}

export function sessaoDuracaoHoras(s: Pick<SessaoCronograma, "horaInicio" | "horaFim">) {
  const [sh, sm] = (s.horaInicio || "00:00").split(":").map(Number);
  const [eh, em] = (s.horaFim || "00:00").split(":").map(Number);
  return Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60);
}

export function horasDoFormador(sessoes: SessaoCronograma[], nome: string) {
  const alvo = nome.trim().toLowerCase();
  return Math.round(sessoes.reduce((acc, s) => {
    if (!isSessaoLectiva(s)) return acc;
    if (!sessaoFormadores(s).some(f => f.toLowerCase() === alvo)) return acc;
    return acc + sessaoDuracaoHoras(s);
  }, 0) * 10) / 10;
}

export function proximaSessao(sessoes: SessaoCronograma[], today = hojeIso()) {
  return [...sessoes]
    .filter(s => isSessaoLectiva(s) && s.data && s.data >= today)
    .sort((a, b) => a.data.localeCompare(b.data) || a.horaInicio.localeCompare(b.horaInicio))[0];
}

export function sessaoEstado(s: SessaoCronograma, today = hojeIso(), nextId?: string): SessaoEstado {
  if (!s.data) return "por-agendar";
  if (s.data < today) return "realizada";
  if (s.data === today) return "hoje";
  if (nextId && s.id === nextId) return "proxima";
  return "agendada";
}

export type CronogramaMesGrupo = {
  key: string;
  label: string;
  items: { sessao: SessaoCronograma; n: number }[];
};

export function groupCronogramaByMonth(sessoes: SessaoCronograma[]): CronogramaMesGrupo[] {
  const groups: CronogramaMesGrupo[] = [];
  sessoes.forEach((sessao, i) => {
    const key = sessao.data ? sessao.data.slice(0, 7) : "sem-data";
    const label = key === "sem-data" ? "Por agendar" : formatMesAno(sessao.data);
    let g = groups.find(x => x.key === key);
    if (!g) {
      g = { key, label, items: [] };
      groups.push(g);
    }
    g.items.push({ sessao, n: i + 1 });
  });
  return groups;
}

export function periodoCronograma(sessoes: SessaoCronograma[]) {
  const datas = sessoes.map(s => s.data).filter(Boolean).sort();
  if (!datas.length) return null;
  return { inicio: datas[0], fim: datas[datas.length - 1] };
}

function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1);
}

function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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

function durationLabel(start: string, end: string) {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  const h = Math.max(1, Math.round(mins / 60));
  return `${h}h`;
}

/** Distribui os módulos do curso (vindos da API) pelas sessões geradas. Sem módulos, fica por definir. */
function moduloGerado(i: number, n: number, _curso: string | undefined, lista?: string[]) {
  if (!lista?.length) return [];
  return [lista[Math.min(lista.length - 1, Math.floor((i * lista.length) / n))]!];
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
  const n = Math.min(24, Math.max(4, Math.ceil((opts.horas || 25) / hours)));
  const cursor = parseIso(opts.inicio || hojeIso());
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
      modulos: moduloGerado(i, n, opts.curso, opts.modulos),
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

export function emptySessao(formador = "A definir"): SessaoCronograma {
  return {
    id: `s-new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    data: "",
    horaInicio: "09:00",
    horaFim: "13:00",
    modulos: [],
    formadores: formador && formador !== "A definir" ? [formador] : [],
    modalidade: "presencial",
  };
}

export function horasPorFormador(sessoes: SessaoCronograma[]) {
  const map = new Map<string, number>();
  for (const s of sessoes) {
    if (!isSessaoLectiva(s)) continue;
    const h = sessaoDuracaoHoras(s);
    for (const nome of sessaoFormadores(s)) {
      if (!nome || nome === "A definir") continue;
      map.set(nome, (map.get(nome) ?? 0) + h);
    }
  }
  return [...map.entries()]
    .map(([nome, horas]) => ({ nome, horas: Math.round(horas * 10) / 10 }))
    .sort((a, b) => b.horas - a.horas || a.nome.localeCompare(b.nome, "pt"));
}

export function horasCronograma(sessoes: SessaoCronograma[]) {
  return sessoes.reduce((acc, s) => {
    if (!isSessaoLectiva(s)) return acc;
    const [sh, sm] = (s.horaInicio || "00:00").split(":").map(Number);
    const [eh, em] = (s.horaFim || "00:00").split(":").map(Number);
    return acc + Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60);
  }, 0);
}

export function cronogramaToSessoes(c: SessaoCronograma[], today = hojeIso()): SessaoMeta[] {
  return c.filter(isSessaoLectiva).map((s, i) => {
    const formadores = sessaoFormadores(s);
    return {
      n: i + 1,
      data: formatSessaoLabel(s.data),
      hora: `${(s.horaInicio || "").replace(":", "h")} a ${(s.horaFim || "").replace(":", "h")}`,
      formador: formadoresLabel(formadores, ""),
      formadores,
      id: s.id,
      dataIso: s.data,
      iniciadaEm: s.iniciadaEm,
      fechadaEm: s.fechadaEm,
      estado: s.fechadaEm ? "Fechada" : s.iniciadaEm ? "Em curso" : s.data && s.data < today ? "Realizada" : "Agendada",
      plano: Boolean(s.data && s.data < today),
      modulo: modulosLabel(s.modulos, ""),
      modulos: s.modulos,
      duracao: durationLabel(s.horaInicio || "09:00", s.horaFim || "13:00"),
    };
  });
}

export function chaveOferta(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[./_,;:()]/g, " ")
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function chaveHorario(s: string) {
  const k = chaveOferta(s).replace(/\s+/g, " ");
  if (!k) return "";
  if (/^pos[- ]?laboral$/.test(k)) return "pos laboral";
  if (/^laboral\s*manha$/.test(k)) return "laboral manha";
  if (/^laboral\s*tarde$/.test(k)) return "laboral tarde";
  if (/^sabado\s*manha$/.test(k)) return "sabado manha";
  return k;
}

export function chaveLocal(s: string) {
  return chaveOferta(s)
    .replace(/\bvila nova de gaia\b/g, "vn gaia")
    .replace(/\bv n gaia\b/g, "vn gaia")
    .replace(/\bvngaia\b/g, "vn gaia");
}

/** Alguns pedidos antigos juntam local e horário em «Lisboa - Pós Laboral». */
export function partirLocalHorario(local: string, horario?: string) {
  const loc = local.trim();
  const hor = (horario ?? "").trim();
  const m = loc.match(/^(.*?)\s*[-–—]\s*(.+)$/);
  if (m && chaveHorario(m[2])) {
    return { local: m[1].trim(), horario: hor || m[2].trim() };
  }
  return { local: loc, horario: hor };
}

export function locaisEquivalentes(a: string, b: string) {
  const x = chaveLocal(a);
  const y = chaveLocal(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [curto, longo] = x.length <= y.length ? [x, y] : [y, x];
  if (curto.length < 8) return false;
  return longo.includes(curto);
}

export type OfertaTurmaRef = { id: number; curso: string; local: string; horario: string; dataInicio?: string };
