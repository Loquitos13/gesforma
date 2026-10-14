import { type ParametroAvaliacao } from "./avaliacaoCurso";

export type Aba = {
  id: string;
  label: string;
  grupo: string;
  parametros: ParametroAvaliacao[];
  pesosEquitativos: boolean;
};

export type FormandoRow = { id: number; nome: string };

export type Sel = { r0: number; c0: number; r1: number; c1: number };

export function normSel(s: Sel): Sel {
  return {
    r0: Math.min(s.r0, s.r1),
    c0: Math.min(s.c0, s.c1),
    r1: Math.max(s.r0, s.r1),
    c1: Math.max(s.c0, s.c1),
  };
}

export function inSel(s: Sel | null, r: number, c: number) {
  if (!s) return false;
  const n = normSel(s);
  return r >= n.r0 && r <= n.r1 && c >= n.c0 && c <= n.c1;
}

export function parseCell(raw: string, cfgMin: number, cfgMax: number): number | null {
  const t = raw.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  const lo = Math.min(cfgMin, cfgMax);
  const hi = Math.max(cfgMin, cfgMax);
  return Math.min(hi, Math.max(lo, n));
}
