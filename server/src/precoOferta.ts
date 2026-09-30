import type { Db } from "./db/pool.js";

export type RegraPreco = { local: string; horario: string; preco: number };

function norm(s: string) {
  return s.trim().toLowerCase();
}

export function escolherPreco(base: number, local: string, horario: string, regras: RegraPreco[]) {
  const L = norm(local);
  const H = norm(horario);
  const lista = regras.filter(r => Number.isFinite(r.preco) && r.preco >= 0 && (norm(r.local) || norm(r.horario)));
  const ambos = lista.find(r => norm(r.local) === L && L !== "" && norm(r.horario) === H && H !== "");
  if (ambos) return ambos.preco;
  const soLocal = lista.find(r => norm(r.local) === L && L !== "" && norm(r.horario) === "");
  if (soLocal) return soLocal.preco;
  const soHorario = lista.find(r => norm(r.local) === "" && norm(r.horario) === H && H !== "");
  if (soHorario) return soHorario.preco;
  return base;
}

function regrasDoPayload(raw: unknown): RegraPreco[] {
  const payload = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  if (!payload || typeof payload !== "object") return [];
  const lista = (payload as { precosOferta?: unknown }).precosOferta;
  if (!Array.isArray(lista)) return [];
  return lista.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const row = item as { local?: unknown; horario?: unknown; preco?: unknown };
    const preco = Number(row.preco);
    if (!Number.isFinite(preco)) return [];
    return [{ local: String(row.local ?? ""), horario: String(row.horario ?? ""), preco }];
  });
}

export async function precoParaOferta(db: Db, curso: string, local: string, horario: string) {
  const row = await db.query<{ preco: number; payload: unknown }>(
    `SELECT cg.preco, cf.payload
       FROM cursos_gold cg
       LEFT JOIN curso_fichas cf ON cf.regime = 'gold' AND cf.curso_id = cg.id
      WHERE lower(trim(cg.nome)) = lower(trim($1))
      LIMIT 1`,
    [curso],
  );
  if (!row.rows[0]) return null;
  const base = Number(row.rows[0].preco ?? 0);
  return escolherPreco(base, local, horario, regrasDoPayload(row.rows[0].payload));
}
