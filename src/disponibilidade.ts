export const SLOTS_CCP = [
  { id: "laboral", label: "Laboral", horas: "9h a 13h", dias: "2.ª a 6.ª" },
  { id: "pos-laboral", label: "Pós-laboral", horas: "16h30 a 23h", dias: "2.ª a 6.ª" },
  { id: "sabado-manha", label: "Sábado manhã", horas: "9h a 13h", dias: "sábado" },
  { id: "sabado-tarde", label: "Sábado tarde", horas: "14h a 19h", dias: "sábado" },
] as const;

export type SlotId = (typeof SLOTS_CCP)[number]["id"];

export const SLOTS_TODOS: SlotId[] = SLOTS_CCP.map(s => s.id);

const JANELAS: Record<SlotId, { dias: number[]; inicio: number; fim: number }> = {
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

export function slotsDoFormador(disponibilidade: string[] | undefined | null): SlotId[] {
  if (disponibilidade == null) return [...SLOTS_TODOS];
  return disponibilidade.filter((id): id is SlotId => SLOTS_TODOS.includes(id as SlotId));
}

export function formadorForaDoSlot(disponibilidade: string[] | undefined | null, horario: string) {
  const slot = slotDoHorario(horario);
  if (!slot) return false;
  return !slotsDoFormador(disponibilidade).includes(slot);
}

/** A sessão cabe inteira numa janela CCP que o formador marcou. */
export function sessaoCabeNoSlot(data: string, inicio: string, fim: string, disponibilidade: string[] | undefined | null) {
  if (!data || !inicio || !fim) return true;
  const slots = slotsDoFormador(disponibilidade);
  if (slots.length === 0) return false;
  const dia = new Date(`${data}T12:00:00`).getDay();
  const a = minutos(inicio);
  const b = minutos(fim);
  if (a == null || b == null || b <= a) return true;
  return slots.some(id => {
    const janela = JANELAS[id];
    return janela.dias.includes(dia) && a >= janela.inicio && b <= janela.fim;
  });
}
