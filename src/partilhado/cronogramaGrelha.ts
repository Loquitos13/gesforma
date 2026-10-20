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
