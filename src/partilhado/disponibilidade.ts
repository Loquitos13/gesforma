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
const SLOTS_DIAS_UTEIS: SlotId[] = ["laboral", "pos-laboral"];

/** A entrada é válida (bloco, bloco num dia ou data indisponível)? */
export function entradaDisponibilidadeValida(v: string) {
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
  const datas = base.filter(v => RE_FORA.test(v));
  const resto = base.filter(v => !RE_FORA.test(v));
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
  const blocos = (disponibilidade ?? [...SLOTS_TODOS]).filter(v => !RE_FORA.test(v));
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

/** A sessão cabe inteira numa janela CCP que o formador marcou (nesse dia da semana) e o dia não está indisponível. */
export function sessaoCabeNoSlot(data: string, inicio: string, fim: string, disponibilidade: string[] | undefined | null) {
  if (!data || !inicio || !fim) return true;
  if (dataIndisponivel(disponibilidade, data)) return false;
  const slots = slotsDoFormador(disponibilidade);
  if (slots.length === 0) return false;
  const dia = new Date(`${data}T12:00:00`).getDay();
  const a = minutos(inicio);
  const b = minutos(fim);
  if (a == null || b == null || b <= a) return true;
  return slots.some(id => {
    const janela = JANELAS[id];
    return slotNoDia(disponibilidade, id, dia) && a >= janela.inicio && b <= janela.fim;
  });
}
