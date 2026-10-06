/** Calendário de Lisboa, independente do fuso do processo. */
export function hojeLisboa(d = new Date()) {
  return dataLisboa(d);
}

function partesLisboa(d: Date, comHora: boolean) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(comHora ? { hour: "2-digit" as const, minute: "2-digit" as const, hourCycle: "h23" as const } : {}),
  }).formatToParts(d);
}

function parte(parts: Intl.DateTimeFormatPart[], tipo: Intl.DateTimeFormatPartTypes) {
  return parts.find(p => p.type === tipo)?.value ?? "";
}

function dataLisboa(d: Date) {
  const parts = partesLisboa(d, false);
  return `${parte(parts, "year")}-${parte(parts, "month")}-${parte(parts, "day")}`;
}

/** Data ou data+hora já escolhida no calendário (não é um instante UTC). */
export function fmtDataCalendario(raw: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(raw.trim());
  if (!m) return raw;
  const data = `${m[3]}/${m[2]}/${m[1]}`;
  return m[4] ? `${data} ${m[4]}:${m[5]}` : data;
}

/** Carimbo gravado em UTC (`toISOString`) mostrado na hora de Lisboa. */
export function fmtStampLisboa(raw: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(raw.trim());
  if (!m) return fmtDataCalendario(raw);
  const utc = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])));
  const parts = partesLisboa(utc, true);
  return `${parte(parts, "day")}/${parte(parts, "month")}/${parte(parts, "year")} ${parte(parts, "hour")}:${parte(parts, "minute")}`;
}
