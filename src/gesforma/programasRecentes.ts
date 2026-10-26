// Programas da Financiada: o último escolhido (neste browser) aparece em primeiro lugar nas listas.
import type { OpcaoSelecao } from "../partilhado/ui";

const CHAVE_PROGRAMAS = "gesforma.programasRecentes";

/** Programas escolhidos há pouco (neste browser), do mais recente para o mais antigo. */
export function programasRecentes(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(CHAVE_PROGRAMAS) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch { return []; }
}

export function lembrarPrograma(valor: string) {
  if (!valor) return;
  try { localStorage.setItem(CHAVE_PROGRAMAS, JSON.stringify([valor, ...programasRecentes().filter(x => x !== valor)].slice(0, 20))); } catch { /* sem armazenamento */ }
}

/** O último programa escolhido fica em primeiro lugar (depois os outros recentes, depois a ordem de sempre). */
export function ordenarPorRecentes(opcoes: OpcaoSelecao[], recentes: string[]) {
  const pos = (v: string) => { const i = recentes.indexOf(v); return i < 0 ? recentes.length : i; };
  return opcoes.map((o, i) => ({ o, i })).sort((a, b) => pos(a.o.valor) - pos(b.o.valor) || a.i - b.i).map(x => x.o);
}
