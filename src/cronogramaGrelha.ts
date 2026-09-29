import {
  codigoModulo,
  emptySessao,
  sessaoModalidade,
  type SessaoCronograma,
  type SessaoModalidade,
} from "./turmaModel";

export type GrelhaLinha = {
  id: string;
  modalidade: Exclude<SessaoModalidade, "matricula">;
  horaInicio: string;
  horaFim: string;
};

export const LINHA_PRESETS: { label: string; linha: GrelhaLinha }[] = [
  { label: "Presencial 11:00 a 13:00", linha: { id: "p-11-13", modalidade: "presencial", horaInicio: "11:00", horaFim: "13:00" } },
  { label: "Presencial 09:00 a 13:30", linha: { id: "p-9-1330", modalidade: "presencial", horaInicio: "09:00", horaFim: "13:30" } },
  { label: "Presencial 09:00 a 13:00", linha: { id: "p-9-13", modalidade: "presencial", horaInicio: "09:00", horaFim: "13:00" } },
  { label: "Presencial 19:00 a 22:00", linha: { id: "p-19-22", modalidade: "presencial", horaInicio: "19:00", horaFim: "22:00" } },
  { label: "Síncrona 10:00 a 11:30", linha: { id: "s-10-1130", modalidade: "sincrona", horaInicio: "10:00", horaFim: "11:30" } },
  { label: "Auto-aprendizagem", linha: { id: "auto", modalidade: "auto", horaInicio: "", horaFim: "" } },
];

const MONTHS_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export function parseIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y || 2026, (m || 1) - 1, d || 1);
}

export function toIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDays(iso: string, n: number) {
  const d = parseIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}

export function weekdayCode(iso: string) {
  return WEEKDAYS[parseIso(iso).getDay()] ?? "";
}

export function monthLabel(iso: string) {
  const m = parseIso(iso).getMonth();
  return MONTHS_FULL[m] ?? "";
}

export function dayNum(iso: string) {
  return String(parseIso(iso).getDate());
}

export const METODOLOGIA_OPTS: { value: Exclude<SessaoModalidade, "matricula" | "avaliacao">; label: string }[] = [
  { value: "presencial", label: "Presencial" },
  { value: "sincrona", label: "Vídeo-Conferência" },
  { value: "auto", label: "Assíncrono / E-learning" },
];

/** Metodologias de uma sessão do cronograma (usadas no collapse de cada sessão). */
export const SESSAO_MODALIDADE_OPTS: { value: Exclude<SessaoModalidade, "matricula" | "avaliacao">; label: string }[] = [
  { value: "presencial", label: "Presencial" },
  { value: "sincrona", label: "Síncrona em Vídeo-Conferência" },
  { value: "auto", label: "Assíncrona / Auto-Aprendizagem" },
];

/** O que se pode marcar num dia da grelha, incluindo o prazo de avaliação. */
export const EVENTO_OPTS: { value: Exclude<SessaoModalidade, "matricula">; label: string }[] = [
  { value: "presencial", label: "Aula presencial" },
  { value: "sincrona", label: "Síncrona em vídeo-conferência" },
  { value: "auto", label: "Assíncrona / auto-aprendizagem" },
  { value: "avaliacao", label: "Limite de entrega / avaliação" },
];

export function normHora(t: string) {
  const m = (t || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return "";
  return `${String(Number(m[1])).padStart(2, "0")}:${m[2]}`;
}

export function horaOficial(t: string) {
  const n = normHora(t);
  if (!n) return "";
  const [h, min] = n.split(":");
  return `${Number(h)}:${min}`;
}

export function formatHoraFaixa(inicio: string, fim: string) {
  const a = horaOficial(inicio);
  const b = horaOficial(fim);
  if (a && b) return `das ${a} às ${b}`;
  return a || b;
}

export function defaultSlot(horario: string, modalidade: GrelhaLinha["modalidade"]) {
  if (modalidade === "auto" || modalidade === "avaliacao") return { horaInicio: "", horaFim: "" };
  if (modalidade === "sincrona") return { horaInicio: "10:00", horaFim: "11:30" };
  if (/pós laboral|pos laboral/i.test(horario)) return { horaInicio: "19:00", horaFim: "22:00" };
  if (/sábado|sabado/i.test(horario)) return { horaInicio: "09:00", horaFim: "13:00" };
  if (/laboral manhã|laboral manha/i.test(horario)) return { horaInicio: "09:00", horaFim: "13:00" };
  return { horaInicio: "09:00", horaFim: "13:00" };
}

export function linhaId(l: Pick<GrelhaLinha, "modalidade" | "horaInicio" | "horaFim">) {
  const hi = l.modalidade === "auto" || l.modalidade === "avaliacao" ? "" : normHora(l.horaInicio);
  const hf = l.modalidade === "auto" || l.modalidade === "avaliacao" ? "" : normHora(l.horaFim);
  return `${l.modalidade}|${hi || "-"}|${hf || "-"}`;
}

export function linhaLabel(l: GrelhaLinha) {
  if (l.modalidade === "auto") return "Online Auto-aprendizagem";
  if (l.modalidade === "avaliacao") return "Prazo de avaliação";
  const faixa = formatHoraFaixa(l.horaInicio, l.horaFim);
  if (faixa) return faixa;
  if (l.modalidade === "sincrona") return "Sessão síncrona";
  return "Aula presencial";
}

export function grupoLinha(m: GrelhaLinha["modalidade"]) {
  if (m === "presencial") return "Horário das aulas presenciais";
  if (m === "sincrona") return "Online Vídeo-conferência";
  if (m === "auto") return "Online Auto-aprendizagem";
  return "Avaliação";
}

export function mergeLinhas(fromSessoes: GrelhaLinha[], extra: GrelhaLinha[]) {
  const seen = new Map<string, GrelhaLinha>();
  for (const l of fromSessoes) seen.set(l.id, l);
  for (const l of extra) {
    if (!seen.has(l.id)) seen.set(l.id, l);
  }
  const order = (a: GrelhaLinha) => {
    const g = a.modalidade === "presencial" ? 0 : a.modalidade === "sincrona" ? 1 : a.modalidade === "auto" ? 2 : 3;
    return `${g}-${a.horaInicio || "99"}`;
  };
  return [...seen.values()].sort((a, b) => order(a).localeCompare(order(b)));
}

export function datasImpressao(opts: {
  matricula?: string;
  inicio?: string;
  fim?: string;
  sessoes: SessaoCronograma[];
}) {
  const lectivas = opts.sessoes
    .filter(s => sessaoModalidade(s) !== "matricula")
    .map(s => s.data)
    .filter(Boolean)
    .sort();
  const start = [opts.matricula, opts.inicio, lectivas[0]].filter(Boolean).sort()[0] ?? "";
  const end = opts.fim && start && opts.fim >= start ? opts.fim : (lectivas[lectivas.length - 1] || start);
  return start ? datesFromRange(start, end || start) : [];
}

export function buildLinha(
  modalidade: Exclude<SessaoModalidade, "matricula">,
  horaInicio: string,
  horaFim: string,
): GrelhaLinha {
  const timed = modalidade !== "auto" && modalidade !== "avaliacao";
  const linha: GrelhaLinha = {
    id: "",
    modalidade,
    horaInicio: timed ? normHora(horaInicio) : "",
    horaFim: timed ? normHora(horaFim) : "",
  };
  linha.id = linhaId(linha);
  return linha;
}

export function aplicarEvento(
  sessoes: SessaoCronograma[],
  date: string,
  linha: GrelhaLinha,
  next: { modulos: string[]; formadores?: string[]; modalidade?: SessaoModalidade } | null,
  previous?: GrelhaLinha | null,
): SessaoCronograma[] {
  let out = sessoes;
  if (previous && previous.id !== linha.id) {
    out = upsertCell(out, date, previous, null);
  }
  return upsertCell(out, date, linha, next);
}

/** Move um evento para outro dia/hora/metodologia, sem alterar os módulos. */
export function moverEvento(
  sessoes: SessaoCronograma[],
  fromDate: string,
  fromLinha: GrelhaLinha,
  toDate: string,
  toLinha: GrelhaLinha,
): SessaoCronograma[] {
  if (fromDate === toDate && fromLinha.id === toLinha.id) return sessoes;
  const origem = cellSessoes(sessoes, fromDate, fromLinha);
  if (!origem.length) return sessoes;
  const destino = cellSessoes(sessoes, toDate, toLinha);
  const pack = (hits: SessaoCronograma[], linha: GrelhaLinha) => {
    const lectiva = linha.modalidade === "presencial" || linha.modalidade === "sincrona";
    return {
      modulos: [...new Set(hits.flatMap(s => s.modulos ?? []))],
      formadores: lectiva ? [...new Set(hits.flatMap(s => s.formadores ?? []))] : [],
      modalidade: linha.modalidade,
    };
  };
  let out = upsertCell(sessoes, fromDate, fromLinha, null);
  out = upsertCell(out, toDate, toLinha, null);
  out = upsertCell(out, toDate, toLinha, pack(origem, toLinha));
  if (destino.length) out = upsertCell(out, fromDate, fromLinha, pack(destino, fromLinha));
  return out;
}

export function cellLabelPrint(sessoes: SessaoCronograma[], date: string, l: GrelhaLinha) {
  const label = cellLabel(sessoes, date, l);
  if (label === "Síncrona") return "Sessão Síncrona";
  return label;
}

export function formatDataOficial(iso: string) {
  const [y, m, d] = (iso || "").split("-");
  if (!y || !m || !d) return "-";
  return `${d}/${m}/${y}`;
}

export function matchLinha(s: SessaoCronograma, l: GrelhaLinha) {
  const m = sessaoModalidade(s);
  if (m === "matricula") return false;
  if (l.modalidade === "auto") return m === "auto";
  if (l.modalidade === "avaliacao") return m === "avaliacao";
  if (m !== l.modalidade && m !== "avaliacao") return false;
  return normHora(s.horaInicio || "") === normHora(l.horaInicio || "") && normHora(s.horaFim || "") === normHora(l.horaFim || "");
}

export function cellSessoes(sessoes: SessaoCronograma[], date: string, l: GrelhaLinha) {
  return sessoes.filter(s => s.data === date && matchLinha(s, l));
}

export function cellLabel(sessoes: SessaoCronograma[], date: string, l: GrelhaLinha) {
  const hits = cellSessoes(sessoes, date, l);
  if (!hits.length) return "";
  if (hits.some(s => sessaoModalidade(s) === "sincrona") && !hits.some(s => s.modulos?.length)) {
    return "Síncrona";
  }
  if (hits.some(s => sessaoModalidade(s) === "avaliacao")) {
    const codes = hits.flatMap(s => s.modulos ?? []).map(codigoModulo);
    return codes.length ? `Aval. ${[...new Set(codes)].join("/")}` : "Avaliação";
  }
  const codes = [...new Set(hits.flatMap(s => (s.modulos ?? []).map(codigoModulo)).filter(Boolean))];
  return codes.join("/");
}

export function linhaDaSessao(s: SessaoCronograma): GrelhaLinha | null {
  const m = sessaoModalidade(s);
  if (m === "matricula") return null;
  return buildLinha(m, s.horaInicio || "", s.horaFim || "");
}

export type EventoDia = { linha: GrelhaLinha; sessoes: SessaoCronograma[] };

/** Eventos marcados num dia, agrupados pela linha da grelha a que pertencem. */
export function eventosDoDia(sessoes: SessaoCronograma[], date: string): EventoDia[] {
  const map = new Map<string, EventoDia>();
  for (const s of sessoes) {
    if (s.data !== date) continue;
    const linha = linhaDaSessao(s);
    if (!linha) continue;
    const hit = map.get(linha.id);
    if (hit) hit.sessoes.push(s);
    else map.set(linha.id, { linha, sessoes: [s] });
  }
  return [...map.values()].sort((a, b) => a.linha.id.localeCompare(b.linha.id));
}

export function linhasFromSessoes(sessoes: SessaoCronograma[], horario?: string): GrelhaLinha[] {
  const seen = new Map<string, GrelhaLinha>();
  for (const s of sessoes) {
    const m = sessaoModalidade(s);
    if (m === "matricula") continue;
    const linha: GrelhaLinha = {
      id: "",
      modalidade: m,
      horaInicio: m === "auto" || m === "avaliacao" ? "" : normHora(s.horaInicio || ""),
      horaFim: m === "auto" || m === "avaliacao" ? "" : normHora(s.horaFim || ""),
    };
    linha.id = linhaId(linha);
    if (!seen.has(linha.id)) seen.set(linha.id, linha);
  }
  if (!seen.size) {
    const labor = /laboral manhã/i.test(horario ?? "");
    const pos = /pós laboral|pos laboral/i.test(horario ?? "");
    const sab = /sábado/i.test(horario ?? "");
    const presets = labor
      ? ["p-11-13", "p-9-1330", "p-9-13", "s-10-1130", "auto"]
      : pos
        ? ["p-19-22", "s-10-1130", "auto"]
        : sab
          ? ["p-9-13", "s-10-1130", "auto"]
          : ["p-9-13", "auto"];
    return LINHA_PRESETS.filter(p => presets.includes(p.linha.id)).map(p => ({ ...p.linha, id: linhaId(p.linha) }));
  }
  const order = (a: GrelhaLinha) => {
    const g = a.modalidade === "presencial" ? 0 : a.modalidade === "sincrona" ? 1 : a.modalidade === "auto" ? 2 : 3;
    return `${g}-${a.horaInicio || "99"}`;
  };
  return [...seen.values()].sort((a, b) => order(a).localeCompare(order(b)));
}

export function datesFromRange(inicio: string, fim: string) {
  if (!inicio) return [];
  const out: string[] = [];
  const end = fim && fim >= inicio ? fim : inicio;
  let cur = inicio;
  for (let i = 0; i < 120 && cur <= end; i++) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

export function grelhaPeriodo(sessoes: SessaoCronograma[], inicio?: string) {
  const datas = sessoes.map(s => s.data).filter(Boolean).sort();
  const matricula = sessoes.find(s => sessaoModalidade(s) === "matricula")?.data;
  const start = [inicio, matricula, datas[0]].filter(Boolean).sort()[0] ?? "";
  const lectivas = sessoes.filter(s => sessaoModalidade(s) !== "matricula").map(s => s.data).filter(Boolean).sort();
  const end = lectivas[lectivas.length - 1] ?? (inicio ? addDays(inicio, 31) : "");
  return { inicio: start, fim: end, matricula };
}

export function monthSpans(dates: string[]) {
  const spans: { key: string; label: string; count: number }[] = [];
  for (const d of dates) {
    const key = d.slice(0, 7);
    const last = spans[spans.length - 1];
    if (last && last.key === key) last.count += 1;
    else spans.push({ key, label: monthLabel(d), count: 1 });
  }
  return spans;
}

function sid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function upsertCell(
  sessoes: SessaoCronograma[],
  date: string,
  linha: GrelhaLinha,
  next: { modulos: string[]; formadores?: string[]; modalidade?: SessaoModalidade } | null,
): SessaoCronograma[] {
  const kept = sessoes.filter(s => !(s.data === date && matchLinha(s, linha)));
  if (!next) return kept;
  const modalidade = next.modalidade ?? linha.modalidade;
  const base = emptySessao();
  return [...kept, {
    ...base,
    id: sid("c"),
    data: date,
    horaInicio: linha.modalidade === "auto" || linha.modalidade === "avaliacao" ? "" : normHora(linha.horaInicio),
    horaFim: linha.modalidade === "auto" || linha.modalidade === "avaliacao" ? "" : normHora(linha.horaFim),
    modulos: next.modulos,
    formadores: next.formadores ?? [],
    modalidade,
  }];
}

export function setMatricula(sessoes: SessaoCronograma[], date: string | "") {
  const rest = sessoes.filter(s => sessaoModalidade(s) !== "matricula");
  if (!date) return rest;
  return [{
    ...emptySessao(),
    id: "matricula",
    data: date,
    horaInicio: "",
    horaFim: "",
    modulos: [],
    formadores: [],
    modalidade: "matricula" as const,
  }, ...rest];
}

export function cellTone(sessoes: SessaoCronograma[], date: string, linha: GrelhaLinha): SessaoModalidade | "empty" {
  const hits = cellSessoes(sessoes, date, linha);
  if (!hits.length) return "empty";
  return sessaoModalidade(hits[0]);
}

const CCP = [
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

function eachDay(inicio: string, fim: string) {
  return datesFromRange(inicio, fim);
}

function weekdaysIn(dates: string[], allowed: number[]) {
  return dates.filter(d => allowed.includes(parseIso(d).getDay()));
}

/** Grelha ao estilo do PDF da ENA (presencial + síncrona + auto-aprendizagem). */
export function generateEnaCronograma(opts: {
  inicio: string;
  horario: string;
  horas: number;
  formador: string;
  curso?: string;
  modulos?: string[];
}): SessaoCronograma[] {
  const inicio = opts.inicio;
  if (!inicio) return [];
  const formadores = opts.formador && opts.formador !== "A definir" ? [opts.formador] : [];
  const ccp = /ccp|formadores/i.test(opts.curso ?? "");
  const mods = (opts.modulos?.length ? opts.modulos : ccp ? CCP : opts.modulos) ?? [];
  const labor = /laboral manhã/i.test(opts.horario);
  const pos = /pós laboral|pos laboral/i.test(opts.horario);
  const allowed = /sábado/i.test(opts.horario) ? [6] : pos ? [1, 2, 3, 4] : [1, 2, 3, 4, 5];
  const span = ccp ? 31 : Math.max(14, Math.ceil((opts.horas || 25) / 4) + 8);
  const fim = addDays(inicio, span);
  const matricula = addDays(inicio, -14);
  const days = eachDay(inicio, fim);
  const aulas = weekdaysIn(days, allowed);
  const out: SessaoCronograma[] = [];

  out.push({
    id: "matricula",
    data: matricula,
    horaInicio: "",
    horaFim: "",
    modulos: [],
    formadores: [],
    modalidade: "matricula",
  });

  function push(data: string, modalidade: SessaoModalidade, horaInicio: string, horaFim: string, modulos: string[]) {
    out.push({
      id: sid("g"),
      data,
      horaInicio,
      horaFim,
      modulos,
      formadores: modalidade === "presencial" || modalidade === "sincrona" ? formadores : [],
      modalidade,
    });
  }

  if (ccp && mods.length >= 9 && aulas.length >= 8) {
    const hi = labor ? { a: ["11:00", "13:00"], b: ["09:00", "13:30"], c: ["09:00", "13:00"] } : { a: ["19:00", "20:30"], b: ["19:00", "22:00"], c: ["19:00", "22:00"] };
    push(aulas[0]!, "presencial", hi.a[0]!, hi.a[1]!, [mods[0]!]);
    push(aulas[1]!, "presencial", hi.b[0]!, hi.b[1]!, [mods[1]!]);
    if (aulas[2]) push(aulas[2], "presencial", hi.b[0]!, hi.b[1]!, [mods[1]!]);
    const mid = aulas.slice(3, 9);
    mid.forEach((d, i) => push(d, "presencial", hi.c[0]!, hi.c[1]!, [mods[2 + i] ?? mods[mods.length - 1]!]));
    const last = aulas.slice(-2);
    last.forEach(d => { if (d !== aulas[0]) push(d, "presencial", hi.b[0]!, hi.b[1]!, [mods[8]!]); });

    const sats = days.filter(d => parseIso(d).getDay() === 6).slice(0, 2);
    (sats.length ? sats : aulas.slice(4, 6)).forEach(d => {
      push(d, "sincrona", "10:00", "11:30", []);
    });

    const presencialDays = new Set(out.filter(s => s.modalidade === "presencial").map(s => s.data));
    const m3day = mid[0] ?? aulas[3];
    const m5day = mid[2] ?? aulas[5];
    const m7day = mid[4] ?? aulas[7];
    for (const d of days) {
      if (presencialDays.has(d)) continue;
      let bloc = [mods[0]!];
      if (m7day && d >= m7day) bloc = [mods[6]!, mods[7]!];
      else if (m5day && d >= m5day) bloc = [mods[4]!, mods[5]!];
      else if (m3day && d >= m3day) bloc = [mods[2]!, mods[3]!];
      push(d, "auto", "", "", bloc);
    }
    return out;
  }

  const slotStart = pos ? "19:00" : "09:00";
  const slotEnd = pos ? "22:00" : "13:00";
  const n = Math.min(aulas.length, Math.max(4, mods.length || Math.ceil((opts.horas || 25) / 4)));
  for (let i = 0; i < n; i++) {
    const d = aulas[i];
    if (!d) break;
    const mod = mods.length ? [mods[Math.min(mods.length - 1, Math.floor((i * Math.max(mods.length, 1)) / n))]!] : [];
    push(d, "presencial", slotStart, slotEnd, mod);
  }
  return out;
}
