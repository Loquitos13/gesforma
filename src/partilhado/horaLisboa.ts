/**
 * Hora de Lisboa, independente do fuso do processo (a Vercel corre em UTC) e do browser.
 * Os instantes continuam guardados em UTC (timestamptz / ISO com Z); o dia civil, o mês, a hora
 * do relógio e as datas mostradas derivam-se sempre daqui.
 */
export const FUSO_LISBOA = "Europe/Lisbon";

type Partes = { ano: string; mes: string; dia: string; hora: string; minuto: string };

const FMT_PARTES = new Intl.DateTimeFormat("en-GB", {
  timeZone: FUSO_LISBOA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const TEXTO_INSTANTE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(:\d{2}(?:\.\d+)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i;

/**
 * Instante a partir de um Date, de um número ou de um texto. Aceita o texto de um timestamptz do
 * Postgres ("2026-07-31 23:30:00.123+00", que nem todos os browsers lêem) e lê um carimbo sem fuso
 * ("2026-07-31 23:30") como UTC, que é como o GesForma os grava.
 */
export function lerInstante(v: Date | string | number): Date {
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v);
  const s = v.trim();
  const m = TEXTO_INSTANTE.exec(s);
  if (!m) return new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : s);
  let fuso = (m[4] ?? "Z").toUpperCase();
  if (fuso !== "Z") fuso = fuso.length === 3 ? `${fuso}:00` : fuso.includes(":") ? fuso : `${fuso.slice(0, 3)}:${fuso.slice(3)}`;
  const seg = m[3] ? m[3].slice(0, 7) : ":00";
  return new Date(`${m[1]}T${m[2]}${seg}${fuso}`);
}

function comoData(v: Date | string | number) {
  return lerInstante(v);
}

/** Ano, mês, dia, hora e minuto do relógio de Lisboa nesse instante. */
export function partesLisboa(instante: Date | string | number = new Date()): Partes {
  const parts = FMT_PARTES.formatToParts(comoData(instante));
  const g = (t: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === t)?.value ?? "";
  // Alguns motores escrevem a meia-noite como "24" mesmo com h23.
  const hora = g("hour") === "24" ? "00" : g("hour");
  return { ano: g("year"), mes: g("month"), dia: g("day"), hora, minuto: g("minute") };
}

function valido(v: Date | string | number) {
  return !Number.isNaN(comoData(v).getTime());
}

/** Dia civil em Lisboa (aaaa-mm-dd). */
export function hojeLisboa(agora: Date | string | number = new Date()) {
  const p = partesLisboa(agora);
  return `${p.ano}-${p.mes}-${p.dia}`;
}

/** Mês civil em Lisboa (aaaa-mm). */
export function mesLisboa(agora: Date | string | number = new Date()) {
  return hojeLisboa(agora).slice(0, 7);
}

/** Ano civil em Lisboa. */
export function anoLisboa(agora: Date | string | number = new Date()) {
  return Number(partesLisboa(agora).ano);
}

/** Hora do relógio de Lisboa (hh:mm, 24 h). */
export function horaLisboa(agora: Date | string | number = new Date()) {
  const p = partesLisboa(agora);
  return `${p.hora}:${p.minuto}`;
}

/** Data e hora de Lisboa "aaaa-mm-dd hh:mm", para notas legíveis (não é um carimbo UTC). */
export function agoraLisboa(agora: Date | string | number = new Date()) {
  return `${hojeLisboa(agora)} ${horaLisboa(agora)}`;
}

/** "aaaa-mm-dd hh:mm" em Lisboa de um instante (Date ou ISO com fuso). Vazio se não for uma data. */
export function stampLisboa(instante: Date | string | number | null | undefined) {
  if (instante === null || instante === undefined || instante === "") return "";
  return valido(instante) ? agoraLisboa(instante) : "";
}

/** Dia civil (Lisboa) de um instante (Date ou ISO com fuso). Vazio se não for uma data. */
export function diaLisboa(instante: Date | string | number | null | undefined) {
  if (instante === null || instante === undefined || instante === "") return "";
  return valido(instante) ? hojeLisboa(instante) : "";
}

/** Soma dias a uma data de calendário aaaa-mm-dd (sem fusos nem horas de verão pelo meio). */
export function somarDias(dia: string, n: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dia);
  if (!m) return dia;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n));
  return d.toISOString().slice(0, 10);
}

/** Primeiro dia do mês de uma data de calendário, deslocado `n` meses (aaaa-mm-01). */
export function inicioMes(dia: string, n = 0) {
  const m = /^(\d{4})-(\d{2})/.exec(dia);
  if (!m) return dia;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + n, 1)).toISOString().slice(0, 10);
}

/**
 * Instante (UTC) em que o relógio de Lisboa marca esse dia e hora. Serve para comparar
 * a data+hora de uma sessão com "agora" sem depender do fuso do processo.
 */
export function instanteLisboa(dia: string, hora = "00:00") {
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(dia);
  const h = /^(\d{1,2}):(\d{2})/.exec(hora);
  if (!d) return new Date(NaN);
  const parede = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), h ? Number(h[1]) : 0, h ? Number(h[2]) : 0);
  const desvio = (t: number) => {
    const p = partesLisboa(new Date(t));
    return Date.UTC(Number(p.ano), Number(p.mes) - 1, Number(p.dia), Number(p.hora), Number(p.minuto)) - t;
  };
  let t = parede - desvio(parede);
  t = parede - desvio(t);
  return new Date(t);
}

/** Instante → "dd/mm/aaaa" em Lisboa. Texto que não é data volta como veio. */
export function fmtDataLisboa(instante: Date | string | number | null | undefined) {
  if (instante === null || instante === undefined || instante === "") return "";
  if (!valido(instante)) return String(instante);
  const p = partesLisboa(instante);
  return `${p.dia}/${p.mes}/${p.ano}`;
}

/** Instante → "dd/mm/aaaa hh:mm" em Lisboa. */
export function fmtDataHoraLisboa(instante: Date | string | number | null | undefined) {
  if (instante === null || instante === undefined || instante === "") return "";
  if (!valido(instante)) return String(instante);
  const p = partesLisboa(instante);
  return `${p.dia}/${p.mes}/${p.ano} ${p.hora}:${p.minuto}`;
}

/** Data ou data+hora já escolhida no calendário (não é um instante UTC). */
export function fmtDataCalendario(raw: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(raw.trim());
  if (!m) return raw;
  const data = `${m[3]}/${m[2]}/${m[1]}`;
  return m[4] ? `${data} ${m[4]}:${m[5]}` : data;
}

const CARIMBO_UTC = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/;

/** Carimbo "aaaa-mm-dd hh:mm" gravado em UTC (sem fuso) → instante. */
function instanteDeCarimbo(raw: string) {
  const m = CARIMBO_UTC.exec(raw.trim());
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])));
}

/** Carimbo gravado em UTC (`toISOString`, sem fuso) mostrado na hora de Lisboa. */
export function fmtStampLisboa(raw: string) {
  const t = instanteDeCarimbo(raw);
  return t ? fmtDataHoraLisboa(t) : fmtDataCalendario(raw);
}

/** Dia civil (Lisboa) de um carimbo UTC sem fuso; uma data simples (aaaa-mm-dd) já é o dia. */
export function diaDeCarimbo(raw: string | null | undefined) {
  const s = String(raw ?? "").trim();
  const t = instanteDeCarimbo(s);
  if (t) return hojeLisboa(t);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}

/** Carimbo UTC sem fuso "aaaa-mm-dd hh:mm" (formato dos campos `inscrito` e `data` de texto). */
export function carimboUtc(agora: Date = new Date()) {
  return agora.toISOString().slice(0, 16).replace("T", " ");
}
