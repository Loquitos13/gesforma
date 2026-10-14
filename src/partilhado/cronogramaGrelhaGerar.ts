// Continuação de cronogramaGrelha.ts (partido para ficar abaixo das 500 linhas).
import { type SessaoCronograma, type SessaoModalidade } from "./turmaModel";
import { parseIso, addDays, sid, eachDay, weekdaysIn } from "./cronogramaGrelha";

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
  const mods = opts.modulos ?? [];
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
