export const SLOTS_CCP = [
  { id: "laboral", label: "Laboral", horas: "9h a 13h", dias: "2.ª a 6.ª" },
  { id: "pos-laboral", label: "Pós-laboral", horas: "16h30 a 23h", dias: "2.ª a 6.ª" },
  { id: "sabado-manha", label: "Sábado manhã", horas: "9h a 13h", dias: "sábado" },
  { id: "sabado-tarde", label: "Sábado tarde", horas: "14h a 19h", dias: "sábado" },
] as const;

export type SlotId = (typeof SLOTS_CCP)[number]["id"];

export const SLOTS_TODOS: SlotId[] = SLOTS_CCP.map(s => s.id);

export const JANELAS: Record<SlotId, { dias: number[]; inicio: number; fim: number }> = {
  laboral: { dias: [1, 2, 3, 4, 5], inicio: 9 * 60, fim: 13 * 60 },
  "pos-laboral": { dias: [1, 2, 3, 4, 5], inicio: 16 * 60 + 30, fim: 23 * 60 },
  "sabado-manha": { dias: [6], inicio: 9 * 60, fim: 13 * 60 },
  "sabado-tarde": { dias: [6], inicio: 14 * 60, fim: 19 * 60 },
};

function semAcento(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function slotDoHorario(horario: string): SlotId | null {
  const h = semAcento(horario);
  if (!h.trim()) return null;
  if (h.includes("sabado") && h.includes("tarde")) return "sabado-tarde";
  if (h.includes("sabado")) return "sabado-manha";
  if (h.includes("pos")) return "pos-laboral";
  if (h.includes("laboral")) return "laboral";
  return null;
}

function minutos(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h)) return null;
  return h * 60 + (Number.isFinite(m) ? m : 0);
}

/*
 * A disponibilidade é uma lista de entradas (texto):
 *  - «laboral», «pos-laboral», «sabado-manha», «sabado-tarde»: o bloco em todos os seus dias;
 *  - «laboral@2», «pos-laboral@4»: o bloco só nesse dia da semana (1 = segunda … 5 = sexta);
 *  - «fora:2026-12-10» ou «fora:2026-12-10..2026-12-15»: um dia (ou período) indisponível.
 * Sem lista (null), o formador está disponível em todos os blocos e não tem datas indisponíveis.
 */
const RE_DIA = /^(laboral|pos-laboral)@([1-5])$/;
const RE_FORA = /^fora:(\d{4}-\d{2}-\d{2})(?:\.\.(\d{4}-\d{2}-\d{2}))?$/;
/** Exceções num dia, com horas: «fora:2026-12-10@14:00-16:00» (indisponível) e «livre:2026-12-12@09:00-13:00» (disponível). */
const RE_HORAS = /^(fora|livre):(\d{4}-\d{2}-\d{2})@([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-4]):([0-5]\d)$/;
const eDeData = (v: string) => RE_FORA.test(v) || RE_HORAS.test(v);
const SLOTS_DIAS_UTEIS: SlotId[] = ["laboral", "pos-laboral"];

/** A entrada é válida (bloco, bloco num dia ou data indisponível)? */
export function entradaDisponibilidadeValida(v: string) {
  const h = RE_HORAS.exec(v);
  if (h) return Number(h[5]) * 60 + Number(h[6]) > Number(h[3]) * 60 + Number(h[4]);
  return SLOTS_TODOS.includes(v as SlotId) || RE_DIA.test(v) || RE_FORA.test(v);
}

/** O bloco está disponível neste dia da semana (0 = domingo … 6 = sábado)? */
export function slotNoDia(disponibilidade: string[] | undefined | null, slot: SlotId, dia: number) {
  if (!JANELAS[slot].dias.includes(dia)) return false;
  if (disponibilidade == null) return true;
  if (disponibilidade.includes(slot)) return true;
  return SLOTS_DIAS_UTEIS.includes(slot) && disponibilidade.includes(`${slot}@${dia}`);
}

/** Os blocos com pelo menos um dia disponível. */
export function slotsDoFormador(disponibilidade: string[] | undefined | null): SlotId[] {
  if (disponibilidade == null) return [...SLOTS_TODOS];
  return SLOTS_TODOS.filter(s => disponibilidade.includes(s) || disponibilidade.some(v => v.startsWith(`${s}@`)));
}

/** Datas (ou períodos) indisponíveis, por ordem. */
export function datasIndisponiveis(disponibilidade: string[] | undefined | null): { de: string; ate: string }[] {
  const out: { de: string; ate: string }[] = [];
  for (const v of disponibilidade ?? []) {
    const m = RE_FORA.exec(v);
    if (!m) continue;
    const de = m[1]!;
    const ate = m[2] && m[2] >= de ? m[2] : de;
    out.push({ de, ate });
  }
  return out.sort((a, b) => a.de.localeCompare(b.de));
}

/** O formador marcou este dia como indisponível? */
export function dataIndisponivel(disponibilidade: string[] | undefined | null, data: string) {
  return datasIndisponiveis(disponibilidade).some(d => data >= d.de && data <= d.ate);
}

/** Liga/desliga um bloco num dia (laboral e pós-laboral por dia; o sábado é um só dia). Arruma a lista. */
export function alternarSlotNoDia(disponibilidade: string[] | undefined | null, slot: SlotId, dia: number): string[] {
  const base = disponibilidade ?? [...SLOTS_TODOS];
  const datas = base.filter(eDeData);
  const resto = base.filter(v => !eDeData(v));
  if (!SLOTS_DIAS_UTEIS.includes(slot)) {
    const on = resto.includes(slot);
    return arrumar([...(on ? resto.filter(v => v !== slot) : [...resto, slot]), ...datas]);
  }
  // Dias úteis: passa a lista explícita por dia e, com os cinco, volta ao bloco inteiro.
  const dias = new Set<number>(JANELAS[slot].dias.filter(d => slotNoDia(resto, slot, d)));
  if (dias.has(dia)) dias.delete(dia); else dias.add(dia);
  const semEste = resto.filter(v => v !== slot && !v.startsWith(`${slot}@`));
  const doSlot = dias.size === 5 ? [slot] : [...dias].sort().map(d => `${slot}@${d}`);
  return arrumar([...semEste, ...doSlot, ...datas]);
}

/** Troca as datas indisponíveis (mantém os blocos). */
export function comDatasIndisponiveis(disponibilidade: string[] | undefined | null, datas: { de: string; ate: string }[]): string[] {
  const base = disponibilidade ?? [...SLOTS_TODOS];
  const blocos = base.filter(v => !RE_FORA.test(v));
  const fora = datas.filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d.de))
    .map(d => (d.ate && d.ate > d.de ? `fora:${d.de}..${d.ate}` : `fora:${d.de}`));
  return arrumar([...blocos, ...fora]);
}

function arrumar(lista: string[]) {
  const ordem = (v: string) => {
    const i = SLOTS_TODOS.findIndex(s => v === s || v.startsWith(`${s}@`));
    return i >= 0 ? i : 99;
  };
  return [...new Set(lista)].sort((a, b) => ordem(a) - ordem(b) || a.localeCompare(b));
}

export function formadorForaDoSlot(disponibilidade: string[] | undefined | null, horario: string) {
  const slot = slotDoHorario(horario);
  if (!slot) return false;
  return !slotsDoFormador(disponibilidade).includes(slot);
}

/**
 * A sessão cabe inteira numa parte disponível desse dia: as janelas da semana, com as exceções da data (dia inteiro
 * indisponível, horas indisponíveis ou horas disponíveis a mais).
 */
export function sessaoCabeNoSlot(data: string, inicio: string, fim: string, disponibilidade: string[] | undefined | null) {
  if (!data || !inicio || !fim) return true;
  const a = minutos(inicio);
  const b = minutos(fim);
  if (a == null || b == null || b <= a) return !dataIndisponivel(disponibilidade, data);
  return disponibilidadeDoDia(disponibilidade, data).disponivel.some(j => a >= j.inicio && b <= j.fim);
}

// ─── Calendário: disponibilidade de cada data, com horas ─────────────────────

export type Intervalo = { inicio: number; fim: number };

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** «9h», «16h30»: para mostrar. */
export function horaCurta(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

function juntar(xs: Intervalo[]): Intervalo[] {
  const ord = [...xs].filter(x => x.fim > x.inicio).sort((a, b) => a.inicio - b.inicio);
  const out: Intervalo[] = [];
  for (const x of ord) {
    const ult = out[out.length - 1];
    if (ult && x.inicio <= ult.fim) ult.fim = Math.max(ult.fim, x.fim);
    else out.push({ ...x });
  }
  return out;
}

function tirar(base: Intervalo[], menos: Intervalo[]): Intervalo[] {
  let res = juntar(base);
  for (const m of juntar(menos)) {
    res = res.flatMap(x => {
      if (m.fim <= x.inicio || m.inicio >= x.fim) return [x];
      const partes: Intervalo[] = [];
      if (m.inicio > x.inicio) partes.push({ inicio: x.inicio, fim: m.inicio });
      if (m.fim < x.fim) partes.push({ inicio: m.fim, fim: x.fim });
      return partes;
    });
  }
  return res;
}

function intersectar(a: Intervalo[], b: Intervalo[]): Intervalo[] {
  const out: Intervalo[] = [];
  for (const x of juntar(a)) for (const y of juntar(b)) {
    const inicio = Math.max(x.inicio, y.inicio);
    const fim = Math.min(x.fim, y.fim);
    if (fim > inicio) out.push({ inicio, fim });
  }
  return juntar(out);
}

/** As exceções com horas de uma data (indisponível e disponível a mais). */
function excecoesDoDia(disponibilidade: string[] | undefined | null, data: string) {
  const fora: Intervalo[] = [];
  const livre: Intervalo[] = [];
  for (const v of disponibilidade ?? []) {
    const m = RE_HORAS.exec(v);
    if (!m || m[2] !== data) continue;
    const iv = { inicio: Number(m[3]) * 60 + Number(m[4]), fim: Number(m[5]) * 60 + Number(m[6]) };
    (m[1] === "fora" ? fora : livre).push(iv);
  }
  return { fora, livre };
}

/** As janelas da semana (blocos) num dia, sem exceções. */
export function janelasDaSemana(disponibilidade: string[] | undefined | null, data: string): Intervalo[] {
  const dia = new Date(`${data}T12:00:00`).getDay();
  return juntar(SLOTS_TODOS.filter(s => slotNoDia(disponibilidade, s, dia)).map(s => ({ inicio: JANELAS[s].inicio, fim: JANELAS[s].fim })));
}

/**
 * Disponibilidade de uma data, com horas: as janelas da semana, mais as horas disponíveis a mais nesse dia, menos as
 * indisponíveis (o dia inteiro, se marcado). «indisponivel» são as horas que deixaram de estar disponíveis nesse dia.
 */
export function disponibilidadeDoDia(disponibilidade: string[] | undefined | null, data: string) {
  const semana = janelasDaSemana(disponibilidade, data);
  const { fora, livre } = excecoesDoDia(disponibilidade, data);
  const base = juntar([...semana, ...livre]);
  if (dataIndisponivel(disponibilidade, data)) return { disponivel: [] as Intervalo[], indisponivel: base.length ? base : [{ inicio: 9 * 60, fim: 23 * 60 }], diaInteiro: true };
  return { disponivel: tirar(base, fora), indisponivel: intersectar(base, fora).length ? intersectar(base, fora) : juntar(fora), diaInteiro: false };
}

/** Marca (ou desmarca) o dia inteiro como indisponível; tira as exceções com horas desse dia. */
export function alternarDiaInteiro(disponibilidade: string[] | undefined | null, data: string): string[] {
  const base = disponibilidade ?? [...SLOTS_TODOS];
  const estava = base.includes(`fora:${data}`);
  const sem = base.filter(v => v !== `fora:${data}` && !(RE_HORAS.exec(v)?.[2] === data));
  return arrumar(estava ? sem : [...sem, `fora:${data}`]);
}

/** Junta uma exceção com horas numa data: «fora» (indisponível) ou «livre» (disponível a mais). */
export function juntarHorasNoDia(disponibilidade: string[] | undefined | null, data: string, tipo: "fora" | "livre", inicio: number, fim: number): string[] {
  const base = (disponibilidade ?? [...SLOTS_TODOS]).filter(v => v !== `fora:${data}`);
  if (!(fim > inicio)) return arrumar(base);
  return arrumar([...base, `${tipo}:${data}@${hhmm(inicio)}-${hhmm(fim)}`]);
}

/** Tira uma exceção (pelo texto exato). */
export function tirarEntrada(disponibilidade: string[] | undefined | null, entrada: string): string[] {
  return arrumar((disponibilidade ?? [...SLOTS_TODOS]).filter(v => v !== entrada));
}

/** As exceções de uma data, para listar e tirar. */
export function excecoesListaveis(disponibilidade: string[] | undefined | null, data: string) {
  return (disponibilidade ?? []).filter(v => v === `fora:${data}` || RE_HORAS.exec(v)?.[2] === data).map(v => {
    const m = RE_HORAS.exec(v);
    return m
      ? { entrada: v, tipo: m[1] as "fora" | "livre", texto: `${m[1] === "fora" ? "Indisponível" : "Disponível"} das ${horaCurta(Number(m[3]) * 60 + Number(m[4]))} às ${horaCurta(Number(m[5]) * 60 + Number(m[6]))}` }
      : { entrada: v, tipo: "fora" as const, texto: "Indisponível todo o dia" };
  });
}
