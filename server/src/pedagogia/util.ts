/** Utilitários puros da pedagogia (sem SQL): leitura de JSON, contagens e nomes de ficheiros. */
import { pastaSegura } from "../dtpPasta.js";
import { dtpDefs, type DtpCounts } from "../dtpModel.js";
import { minutosSessao, type SessaoRelatorio } from "../relatorioFinal.js";

export type Regime = "gold" | "fin";

/** Array de inteiros no formato de texto do Postgres, para passar como parâmetro `$n::int[]`. */
export function pgIntArray(ids: number[]) {
  return `{${ids.filter(n => Number.isFinite(n)).map(n => Math.trunc(Number(n))).join(",")}}`;
}

/** Array de texto no formato do Postgres, para passar como parâmetro `$n::text[]`. */
export function pgTextArray(values: string[]) {
  const body = values
    .map(v => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",");
  return `{${body}}`;
}

export function asObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
    } catch { return {}; }
  }
  return {};
}

export function asArr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  }
  return [];
}

/** A ficha do curso sem os valores internos (custo do formador) para quem não é da secretaria. */
export function fichaParaPapel(payload: Record<string, unknown>, role: string) {
  if (role === "admin" || role === "secretaria") return payload;
  const { valoresFormador: _interno, ...resto } = payload;
  return resto;
}

export function planoPreenchido(plano: unknown) {
  const p = asObj(plano);
  if (String(p.objetivosGerais ?? "").trim()) return true;
  const momentos = asObj(p.momentos);
  return Object.values(momentos).some(m => String(asObj(m).conteudo ?? "").trim().length > 0);
}

export function pipCounts(payload: unknown): DtpCounts | null {
  const items = asArr(payload);
  if (!items.length) return null;
  const done = items.filter(i => String(asObj(i).fileName ?? "").trim()).length;
  return { done, total: items.length };
}

export function simCounts(payload: unknown): DtpCounts | null {
  const items = asArr(payload);
  if (!items.length) return null;
  const done = items.filter(i => {
    const it = asObj(i);
    if (!String(it.videoName ?? "").trim()) return false;
    const vals = Object.values(asObj(it.notas));
    return vals.length > 0 && vals.every(v => typeof v === "number" && Number.isFinite(v));
  }).length;
  return { done, total: items.length };
}

export function horasDaSessao(s: SessaoRelatorio) {
  const minutos = minutosSessao(s.horaInicio, s.horaFim);
  return minutos > 0 ? minutos / 60 : 0;
}

export function linhasDe(valor: unknown) {
  return String(valor ?? "").split(/\n+/).map(l => l.trim()).filter(Boolean);
}

export function slugExtra(label: string) {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

type ExtraEntrada = { id?: string; fase: "antes" | "durante" | "depois"; label: string; fonte?: string; hint?: string; bloqueante?: boolean; ambito?: "turma" | "formando" | "formador" };

/** Documentos extra do modelo do dossiê: ids únicos, textos aparados. */
export function normalizarExtras(extra: ExtraEntrada[], fonteDefault: string) {
  const usados = new Set<string>();
  return extra
    .map(x => ({
      id: (x.id?.trim() || slugExtra(x.label)).slice(0, 40),
      fase: x.fase,
      label: x.label.trim(),
      fonte: (x.fonte?.trim() || fonteDefault).slice(0, 120),
      hint: (x.hint?.trim() || "").slice(0, 240),
      bloqueante: Boolean(x.bloqueante),
      ambito: x.ambito ?? "turma" as const,
    }))
    .filter(x => {
      if (!x.id || !x.label || usados.has(x.id)) return false;
      usados.add(x.id);
      return true;
    });
}

/** Ids da base do dossiê que se podem excluir (os obrigatórios ficam sempre). */
export function idsBase(regime: Regime, ids: string[], opts?: { extras?: boolean }) {
  const travados = new Set(dtpDefs(regime).filter(d => d.obrigatorio).map(d => d.id));
  const conhecidos = new Set(dtpDefs(regime).map(d => d.id));
  return [...new Set(ids)].filter(x => {
    if (x.startsWith("extra:")) return Boolean(opts?.extras) && x.length > "extra:".length;
    return conhecidos.has(x) && !travados.has(x);
  });
}

export function uniqueZipPath(used: Set<string>, path: string) {
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const i = path.lastIndexOf(".");
  const base = i > 0 ? path.slice(0, i) : path;
  const ext = i > 0 ? path.slice(i) : "";
  let n = 2;
  while (used.has(`${base}-${n}${ext}`)) n += 1;
  const next = `${base}-${n}${ext}`;
  used.add(next);
  return next;
}

export function nomeArquivoDtp(label: string | undefined, original: string) {
  const orig = pastaSegura(original || "ficheiro.pdf");
  if (!label) return orig;
  if (orig.toLowerCase().includes(label.toLowerCase().slice(0, 16))) return orig;
  return pastaSegura(`${label} - ${orig}`);
}
