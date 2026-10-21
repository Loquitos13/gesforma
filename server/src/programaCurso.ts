import type { Db } from "./db/pool.js";
import { fichaDoCursoPorNome } from "./repos/oferta.js";

function asObj(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object") return raw as Record<string, unknown>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Rótulos do programa tal como a ficha os mostra (Gold e Financiada): «M1 · Título · 25h» no modular,
 * «Título · 25h» no livre (os capítulos não têm código). Sem catálogo paralelo.
 */
export function labelsDePayload(raw: unknown): string[] {
  const payload = asObj(raw);
  const livre = payload.organizacaoPrograma === "livre";
  const lista = payload.topicosPrograma;
  if (!Array.isArray(lista) || !lista.length) return [];
  const out: string[] = [];
  lista.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const row = item as { titulo?: unknown; nome?: unknown; horas?: unknown };
    const titulo = String(row.titulo ?? row.nome ?? "").trim();
    if (!titulo) return;
    const horas = String(row.horas ?? "").trim();
    out.push([livre ? "" : `M${i + 1}`, titulo, horas].filter(Boolean).join(" · "));
  });
  return out;
}

export async function modulosDaFicha(db: Db, regime: "gold" | "fin", curso: string): Promise<string[]> {
  const nome = curso.trim();
  if (!nome) return [];
  return labelsDePayload(await fichaDoCursoPorNome(db, regime, nome));
}
