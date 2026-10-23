/** Formatação pt-PT partilhada pelos ecrãs e gráficos. */
import { fmtDataCalendario, fmtDataHoraLisboa, fmtDataLisboa, lerInstante } from "../horaLisboa.js";

const nf = new Intl.NumberFormat("pt-PT");
const ef = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const ef2 = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type Formato = "eur" | "eur2" | "num" | "pct" | "horas";

export function eur(v: number, casas = false) {
  return (casas ? ef2 : ef).format(Number.isFinite(v) ? v : 0);
}

/**
 * Número escrito à portuguesa: "1.500,25" → 1500.25; sem vírgula, "1.500" (ponto seguido de grupos de 3 dígitos)
 * são milhares → 1500; "1.5" continua a ser 1,5. O símbolo do euro e os espaços (também os não separáveis) ignoram-se.
 */
export function numeroPt(texto: string) {
  const s = texto.replace(/[\s€]/g, "");
  if (s.includes(",")) return Number(s.replace(/\./g, "").replace(",", "."));
  if (/^-?[1-9]\d{0,2}(\.\d{3})+$/.test(s)) return Number(s.replace(/\./g, ""));
  return Number(s);
}

export function num(v: number) {
  return nf.format(Number.isFinite(v) ? v : 0);
}

export function formatar(v: number, f: Formato) {
  switch (f) {
    case "eur": return eur(v);
    case "eur2": return eur(v, true);
    case "pct": return `${num(Math.round(v))} %`;
    case "horas": return `${num(Math.round(v * 10) / 10)} h`;
    default: return num(v);
  }
}

export type Tom = "sucesso" | "aviso" | "perigo" | "info" | "neutro" | "acao";

/**
 * Evolução de `a` face a `b`. Percentagem por omissão; `pp` para valores que já são
 * percentagens (diferença em pontos percentuais). Sem base (`b` = 0) devolve "—".
 */
export function evolucao(a: number, b: number, opts: { pp?: boolean; inverso?: boolean } = {}): { texto: string; tom: Tom; delta: number | null } {
  if (!opts.pp && !b) return { texto: "—", tom: "neutro", delta: null };
  const d = opts.pp ? Math.round(a - b) : Math.round(((a - b) / b) * 100);
  const sinal = d > 0 ? "+" : d < 0 ? "−" : "";
  const texto = `${sinal}${Math.abs(d)}${opts.pp ? " p.p." : " %"}`;
  if (d === 0) return { texto, tom: "neutro", delta: 0 };
  const bom = opts.inverso ? d < 0 : d > 0;
  return { texto, tom: bom ? "sucesso" : "perigo", delta: d };
}

/** Classes de texto/fundo por tom. */
export const TOM_CLASSES: Record<Tom, { texto: string; fundo: string; borda: string }> = {
  sucesso: { texto: "text-sucesso", fundo: "bg-sucesso-suave", borda: "border-sucesso/30" },
  aviso: { texto: "text-aviso", fundo: "bg-aviso-suave", borda: "border-aviso/30" },
  perigo: { texto: "text-perigo", fundo: "bg-perigo-suave", borda: "border-perigo/30" },
  info: { texto: "text-ligacao", fundo: "bg-ligacao-suave", borda: "border-ligacao/30" },
  neutro: { texto: "text-tinta-suave", fundo: "bg-linha-suave", borda: "border-linha" },
  acao: { texto: "text-acao-texto", fundo: "bg-acao-suave", borda: "border-acao/40" },
};

/** Instante de um texto: com fuso tal como vem; sem fuso (carimbo do GesForma), lido como UTC. */
const instante = lerInstante;

/** Data ISO (aaaa-mm-dd ou timestamp) → "13-10-2026", no dia de Lisboa. */
export function data(iso: string | null | undefined) {
  if (!iso) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return fmtDataCalendario(iso);
  const d = instante(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return fmtDataLisboa(d);
}

/** Data e hora curtas na hora de Lisboa: "13-10-2026, 14:05". */
export function dataHora(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = instante(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return fmtDataHoraLisboa(d).replace(" ", ", ");
}

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
