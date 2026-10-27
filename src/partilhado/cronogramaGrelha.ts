import { codigoModulo, emptySessao, ordenarCodigos, sessaoModalidade, type SessaoCronograma, type SessaoModalidade } from "./turmaModel";

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
  if (!previous || previous.id === linha.id) return upsertCell(sessoes, date, linha, next);
  const anterior = sessoes.find(s => s.data === date && matchLinha(s, previous));
  const out = upsertCell(sessoes, date, previous, null);
  if (!anterior || !next || out.some(s => s.data === date && matchLinha(s, linha))) return upsertCell(out, date, linha, next);
  // Muda de linha mantendo o id: os sumários e presenças da sessão ligam-se ao id.
  const i = sessoes.indexOf(anterior);
  return upsertCell([...out.slice(0, i), naLinha(anterior, date, linha), ...out.slice(i)], date, linha, next);
}

/** Move um evento para outro dia/hora/metodologia, sem alterar os módulos nem a posição na lista. */
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
  const mover = (s: SessaoCronograma, date: string, linha: GrelhaLinha) => {
    const lectiva = linha.modalidade === "presencial" || linha.modalidade === "sincrona";
    return { ...naLinha(s, date, linha), formadores: lectiva ? (s.formadores ?? []) : [] };
  };
  // Troca mantendo os ids: os sumários e presenças acompanham cada sessão.
  return sessoes.map(s => origem.includes(s) ? mover(s, toDate, toLinha) : destino.includes(s) ? mover(s, fromDate, fromLinha) : s);
}

export function cellLabelPrint(sessoes: SessaoCronograma[], date: string, l: GrelhaLinha) {
  const label = cellLabel(sessoes, date, l);
  if (label === "Síncrona") return "Sessão Síncrona";
  return label;
}

export function matchLinha(s: SessaoCronograma, l: GrelhaLinha) {
  const m = sessaoModalidade(s);
  if (m === "matricula") return false;
  if (l.modalidade === "auto") return m === "auto";
  if (l.modalidade === "avaliacao") return m === "avaliacao";
  if (m !== l.modalidade && m !== "avaliacao") return false;
  return normHora(s.horaInicio || "") === normHora(l.horaInicio || "") && normHora(s.horaFim || "") === normHora(l.horaFim || "");
}

/** Marca a data de fim do cronograma sem ser uma sessão visível. */
export const FIM_CRONOGRAMA_ID = "fim-cronograma";

export function eMarcoFim(s: { id?: string }) {
  return s.id === FIM_CRONOGRAMA_ID;
}

export function sessoesSemFim(sessoes: SessaoCronograma[]) {
  return sessoes.filter(s => !eMarcoFim(s));
}

export function fimDoCronograma(sessoes: SessaoCronograma[]) {
  return sessoes.find(eMarcoFim)?.data ?? "";
}

export function comFimCronograma(sessoes: SessaoCronograma[], fim: string) {
  const sem = sessoesSemFim(sessoes);
  if (!fim) return sem;
  return [...sem, {
    id: FIM_CRONOGRAMA_ID,
    data: fim,
    horaInicio: "",
    horaFim: "",
    modulos: [],
    formadores: [],
    modalidade: "auto" as const,
  }];
}

/** A data de fim não recua quando se apaga a última sessão; só avança se houver sessão depois dela. */
export function fimEstavel(sessoes: SessaoCronograma[], fimActual: string) {
  const datas = sessoesSemFim(sessoes)
    .filter(s => sessaoModalidade(s) !== "matricula")
    .map(s => s.data)
    .filter(Boolean)
    .sort();
  const ultimo = datas[datas.length - 1] ?? "";
  if (ultimo && fimActual && ultimo > fimActual) return ultimo;
  return fimActual || ultimo;
}

export function cellSessoes(sessoes: SessaoCronograma[], date: string, l: GrelhaLinha) {
  return sessoesSemFim(sessoes).filter(s => s.data === date && matchLinha(s, l));
}

export function cellLabel(sessoes: SessaoCronograma[], date: string, l: GrelhaLinha) {
  const hits = cellSessoes(sessoes, date, l);
  if (!hits.length) return "";
  if (hits.some(s => sessaoModalidade(s) === "sincrona") && !hits.some(s => s.modulos?.length)) {
    return "Síncrona";
  }
  if (hits.some(s => sessaoModalidade(s) === "avaliacao")) {
    const codes = ordenarCodigos(hits.flatMap(s => s.modulos ?? []).map(codigoModulo));
    return codes.length ? `Aval. ${codes.join("/")}` : "Avaliação";
  }
  const codes = ordenarCodigos(hits.flatMap(s => (s.modulos ?? []).map(codigoModulo)));
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
  for (const s of sessoesSemFim(sessoes)) {
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
  for (const s of sessoesSemFim(sessoes)) {
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
  const vis = sessoesSemFim(sessoes);
  const datas = vis.map(s => s.data).filter(Boolean).sort();
  const matricula = vis.find(s => sessaoModalidade(s) === "matricula")?.data;
  const start = [inicio, matricula, datas[0]].filter(Boolean).sort()[0] ?? "";
  const lectivas = vis.filter(s => sessaoModalidade(s) !== "matricula").map(s => s.data).filter(Boolean).sort();
  const ultimo = lectivas[lectivas.length - 1] ?? "";
  const guardado = fimDoCronograma(sessoes);
  const end = (guardado && ultimo ? (guardado > ultimo ? guardado : ultimo) : guardado || ultimo)
    || (inicio ? addDays(inicio, 31) : "");
  return { inicio: start, fim: end, matricula };
}

/** Caracteres da linha mais comprida. Códigos como M7/M8 ficam juntos; o resto parte nos espaços. */
export function charsDaCelula(texto: string) {
  const t = texto.trim();
  if (!t) return 0;
  const linhas = t.split(/\s+/).filter(Boolean);
  return linhas.reduce((m, l) => Math.max(m, l.length), 0);
}

/** Cada dia fica largo o suficiente para o conteúdo e para o nome do mês não partir. */
export function larguraDiasEmChars(dates: string[], rotulos: string[][]) {
  const base = dates.map((d, i) => {
    const textos = [dayNum(d), weekdayCode(d), ...(rotulos[i] ?? [])];
    return Math.max(2, ...textos.map(charsDaCelula));
  });
  const months = monthSpans(dates);
  let cursor = 0;
  for (const m of months) {
    const soma = base.slice(cursor, cursor + m.count).reduce((a, b) => a + b, 0);
    const preciso = m.label.length + 1;
    if (m.count && soma < preciso) {
      const extra = (preciso - soma) / m.count;
      for (let k = 0; k < m.count; k++) base[cursor + k] = (base[cursor + k] ?? 0) + extra;
    }
    cursor += m.count;
  }
  return base;
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

export function sid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/** A sessão passada para a célula (dia e linha) da grelha. */
function naLinha(s: SessaoCronograma, date: string, linha: GrelhaLinha, modalidade: SessaoModalidade = linha.modalidade): SessaoCronograma {
  const semHora = linha.modalidade === "auto" || linha.modalidade === "avaliacao";
  return { ...s, data: date, horaInicio: semHora ? "" : normHora(linha.horaInicio), horaFim: semHora ? "" : normHora(linha.horaFim), modalidade };
}

/** Grava a célula. Uma sessão que já lá está é substituída no mesmo lugar (mantém id e posição); uma nova vai para o fim. */
export function upsertCell(
  sessoes: SessaoCronograma[],
  date: string,
  linha: GrelhaLinha,
  next: { modulos: string[]; formadores?: string[]; modalidade?: SessaoModalidade } | null,
): SessaoCronograma[] {
  const naCelula = (s: SessaoCronograma) => s.data === date && matchLinha(s, linha);
  const i = sessoes.findIndex(naCelula);
  const kept = sessoes.filter(s => !naCelula(s));
  if (!next) return kept;
  const atual = i >= 0 ? sessoes[i]! : { ...emptySessao(), id: sid("c") };
  const nova = { ...naLinha(atual, date, linha, next.modalidade ?? linha.modalidade), modulos: next.modulos, formadores: next.formadores ?? [] };
  return i < 0 ? [...kept, nova] : [...kept.slice(0, i), nova, ...kept.slice(i)];
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

export function eachDay(inicio: string, fim: string) {
  return datesFromRange(inicio, fim);
}

export function weekdaysIn(dates: string[], allowed: number[]) {
  return dates.filter(d => allowed.includes(parseIso(d).getDay()));
}

/**
 * Dias vazios entre a data limite de matrícula e o início (sem nenhum evento): a partir de 3 seguidos, a grelha
 * mostra-os numa só coluna («…»), em vez de uma faixa de colunas em branco.
 */
export function saltoMatricula(dates: string[], sessoes: SessaoCronograma[], matricula: string, inicio: string) {
  if (!matricula || !inicio || matricula >= inicio) return null;
  const comEvento = new Set(sessoesSemFim(sessoes).filter(s => sessaoModalidade(s) !== "matricula").map(s => s.data));
  const vazios = dates.filter(d => d > matricula && d < inicio);
  if (vazios.length < 3 || vazios.some(d => comEvento.has(d))) return null;
  return { de: vazios[0]!, ate: vazios[vazios.length - 1]!, n: vazios.length };
}

/** Repetir um evento até uma data: todos os dias, só nos dias úteis, ou uma vez por semana (no mesmo dia da semana). */
export type Repeticao = "dias" | "uteis" | "semanal";

/** Os dias de `de` a `ate` (inclusive) em que o evento se repete. */
export function diasDaRepeticao(de: string, ate: string, repeticao: Repeticao = "dias") {
  const semana = parseIso(de).getDay();
  return datesFromRange(de, ate).filter(d => {
    const dia = parseIso(d).getDay();
    if (repeticao === "uteis") return dia !== 0 && dia !== 6;
    if (repeticao === "semanal") return dia === semana;
    return true;
  });
}

/**
 * O mesmo evento nos dias de `de` a `ate` (ex.: e-learning de um módulo durante uma semana, ou a mesma sessão
 * presencial todas as segundas). Os outros dias que já têm este evento ficam como estão (com os seus módulos e dados).
 */
export function preencherIntervalo(
  sessoes: SessaoCronograma[],
  de: string,
  ate: string,
  linha: GrelhaLinha,
  next: { modulos: string[]; formadores?: string[]; modalidade?: SessaoModalidade },
  repeticao: Repeticao = "dias",
) {
  let out = sessoes;
  for (const d of diasDaRepeticao(de, ate, repeticao)) {
    if (d !== de && out.some(s => s.data === d && matchLinha(s, linha))) continue;
    out = upsertCell(out, d, linha, next);
  }
  return out;
}

/**
 * Muda a hora de uma linha inteira da grelha (todas as sessões dessa linha passam ao novo horário, com os mesmos ids).
 * Recusa quando o novo horário já tem sessões nos mesmos dias.
 */
export function mudarHorasLinha(sessoes: SessaoCronograma[], linha: GrelhaLinha, horaInicio: string, horaFim: string): { ok: true; sessoes: SessaoCronograma[]; linha: GrelhaLinha } | { ok: false; erro: string } {
  if (linha.modalidade !== "presencial" && linha.modalidade !== "sincrona") return { ok: false, erro: "Esta linha não tem horário." };
  const hi = normHora(horaInicio);
  const hf = normHora(horaFim);
  if (!hi || !hf) return { ok: false, erro: "Escolha a hora de início e de fim." };
  if (hi >= hf) return { ok: false, erro: "A hora de fim tem de ser depois da de início." };
  const nova = buildLinha(linha.modalidade, hi, hf);
  if (nova.id === linha.id) return { ok: true, sessoes, linha: nova };
  const daLinha = (s: SessaoCronograma) => !eMarcoFim(s) && matchLinha(s, linha);
  const dias = new Set(sessoes.filter(daLinha).map(s => s.data));
  if (sessoes.some(s => !eMarcoFim(s) && !daLinha(s) && dias.has(s.data) && matchLinha(s, nova))) {
    return { ok: false, erro: "Já há sessões nesse horário em dias desta linha." };
  }
  return { ok: true, linha: nova, sessoes: sessoes.map(s => (daLinha(s) ? { ...s, horaInicio: hi, horaFim: hf } : s)) };
}

// ── Grelha de tempos (aulas presenciais e síncronas) ──────────────────────────────────────────────────────────
// As linhas são tempos lectivos de 45 minutos; cada sessão ocupa os tempos da sua duração e o último fica
// preenchido só na parte que a sessão usa (ex.: 3h30 = quatro tempos inteiros e 30 dos 45 minutos do quinto).

export const TEMPO_MIN = 45;

export const minutosDaHora = (h: string) => {
  const n = normHora(h);
  if (!n) return null;
  const [hh, mm] = n.split(":").map(Number);
  return hh! * 60 + mm!;
};

export const horaDosMinutos = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export type BlocoTempos = {
  date: string;
  /** Primeira linha (tempo) e quantas ocupa. */
  linha: number; linhas: number;
  /** Cada sessão do bloco, com a posição em percentagem dentro do bloco (sessões sobrepostas ficam lado a lado). */
  sessoes: { s: SessaoCronograma; topo: number; altura: number; coluna: number; colunas: number }[];
};

export function grelhaTempos(sessoes: SessaoCronograma[], dates: string[], horario: string, tempo = TEMPO_MIN) {
  const lectivas = sessoesSemFim(sessoes).filter(s => {
    const m = sessaoModalidade(s);
    return (m === "presencial" || m === "sincrona") && minutosDaHora(s.horaInicio) != null && minutosDaHora(s.horaFim) != null
      && minutosDaHora(s.horaFim)! > minutosDaHora(s.horaInicio)!;
  });
  const padrao = defaultSlot(horario, "presencial");
  const inicios = [...lectivas.map(s => minutosDaHora(s.horaInicio)!), minutosDaHora(padrao.horaInicio)!];
  const fins = [...lectivas.map(s => minutosDaHora(s.horaFim)!), minutosDaHora(padrao.horaFim)!];
  const base = Math.min(...inicios);
  const n = Math.max(1, Math.ceil((Math.max(...fins) - base) / tempo));
  const dias = new Set(dates);
  const blocos: BlocoTempos[] = [];
  const porDia = new Map<string, SessaoCronograma[]>();
  for (const s of lectivas) if (dias.has(s.data)) porDia.set(s.data, [...(porDia.get(s.data) ?? []), s]);
  for (const [date, lista] of porDia) {
    // Sessões que se sobrepõem no mesmo dia juntam-se num bloco.
    const ord = [...lista].sort((a, b) => minutosDaHora(a.horaInicio)! - minutosDaHora(b.horaInicio)!);
    let grupo: SessaoCronograma[] = [];
    let fimGrupo = -1;
    const fechar = () => {
      if (!grupo.length) return;
      const ini = Math.min(...grupo.map(s => minutosDaHora(s.horaInicio)!));
      const fim = Math.max(...grupo.map(s => minutosDaHora(s.horaFim)!));
      const linha = Math.floor((ini - base) / tempo);
      const linhas = Math.max(1, Math.ceil((fim - base) / tempo) - linha);
      const total = linhas * tempo;
      const topo0 = base + linha * tempo;
      // Só as que se sobrepõem de facto ficam lado a lado; as seguidas ficam uma por baixo da outra.
      const fimDaColuna: number[] = [];
      const colunaDe = grupo.map(s => {
        const ini = minutosDaHora(s.horaInicio)!;
        let c = fimDaColuna.findIndex(f => f <= ini);
        if (c < 0) { c = fimDaColuna.length; fimDaColuna.push(0); }
        fimDaColuna[c] = minutosDaHora(s.horaFim)!;
        return c;
      });
      blocos.push({
        date, linha, linhas,
        sessoes: grupo.map((s, i) => ({
          s,
          topo: ((minutosDaHora(s.horaInicio)! - topo0) / total) * 100,
          altura: ((minutosDaHora(s.horaFim)! - minutosDaHora(s.horaInicio)!) / total) * 100,
          coluna: colunaDe[i]!, colunas: fimDaColuna.length,
        })),
      });
      grupo = [];
    };
    // Fim do grupo arredondado ao tempo: uma sessão que começa num tempo já ocupado entra no mesmo bloco.
    const fimEmTempos = (m: number) => base + Math.ceil((m - base) / tempo) * tempo;
    for (const s of ord) {
      const ini = minutosDaHora(s.horaInicio)!;
      if (grupo.length && ini >= fimEmTempos(fimGrupo)) fechar();
      grupo.push(s);
      fimGrupo = Math.max(fimGrupo, minutosDaHora(s.horaFim)!);
    }
    fechar();
  }
  return { base, n, tempo, blocos, inicioDaLinha: (i: number) => horaDosMinutos(base + i * tempo) };
}

/**
 * O que a sessão trata, para o bloco da grelha: no curso modular, o código e o nome do módulo
 * («M1» + «Aprendizagem e pedagogia»); no curso sem módulos, o tema (o título do capítulo). Sem as horas.
 */
export function temasDaSessao(s: SessaoCronograma) {
  return (s.modulos ?? []).map(raw => {
    const nome = raw.trim().replace(/\s*·\s*\d+\s*h(?:\s*\d{1,2})?\s*(?:min)?\s*$/i, "");
    const m = /^((?:M|C|EX|AV)\s*\d+|UFCD\s*\d+)\s*[·.\-–:]?\s*(.*)$/i.exec(nome);
    return m ? { codigo: m[1]!.replace(/\s+/g, " "), titulo: m[2]!.trim() } : { codigo: "", titulo: nome };
  }).filter(t => t.codigo || t.titulo);
}
