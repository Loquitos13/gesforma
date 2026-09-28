import type { CSSProperties, ReactNode } from "react";

export const CRM_MEIOS = ["Telefone", "WhatsApp", "Email", "SMS", "Presencial"] as const;

export const CRM_ETIQUETA_CORES = [
  "#dc2626", "#ea580c", "#f59e0b", "#16a34a", "#0d9488",
  "#2563eb", "#7c3aed", "#db2777", "#64748b", "#0f172a",
];

export function hexTint(hex: string, alpha = 0.16) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const n = Number.parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function leadMarkStyle(cor?: string | null): CSSProperties | undefined {
  if (!cor) return undefined;
  const bg = hexTint(cor, 0.14);
  if (!bg) return undefined;
  return { backgroundColor: bg, boxShadow: `inset 4px 0 0 ${cor}` };
}

export function entradaChip(entrada?: string): ReactNode {
  const manual = entrada === "manual";
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide border ${
      manual ? "bg-sky-50 text-sky-800 border-sky-200" : "bg-amber-50 text-amber-900 border-amber-200"
    }`}>{manual ? "Manual" : "Pré-inscrição"}</span>
  );
}

export function etiquetaChip(nome?: string | null, cor?: string | null) {
  if (!nome) return null;
  const c = cor && /^#?[0-9a-f]{6}$/i.test(cor) ? (cor.startsWith("#") ? cor : `#${cor}`) : "#64748b";
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border border-black/10"
      style={{ backgroundColor: hexTint(c, 0.22), color: c }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
      {nome}
    </span>
  );
}

export function meioChip(meio?: string | null) {
  if (!meio) return <span className="text-[11px] text-slate-400">-</span>;
  return <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-white/80 text-slate-700 border border-slate-200">{meio}</span>;
}
