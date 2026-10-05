import type { Db } from "./db/pool.js";

export type RegraPreco = { local: string; horario: string; preco: number };

type CursoPreco = { nome: string; base: number; regras: RegraPreco[] };

export function normPreco(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function escolherPreco(base: number, local: string, horario: string, regras: RegraPreco[]) {
  const L = normPreco(local);
  const H = normPreco(horario);
  const lista = regras.filter(r => Number.isFinite(r.preco) && r.preco >= 0 && (normPreco(r.local) || normPreco(r.horario)));
  const ambos = lista.find(r => normPreco(r.local) === L && L !== "" && normPreco(r.horario) === H && H !== "");
  if (ambos) return ambos.preco;
  const soLocal = lista.find(r => normPreco(r.local) === L && L !== "" && normPreco(r.horario) === "");
  if (soLocal) return soLocal.preco;
  const soHorario = lista.find(r => normPreco(r.local) === "" && normPreco(r.horario) === H && H !== "");
  if (soHorario) return soHorario.preco;
  return base;
}

export function regrasDoPayload(raw: unknown): RegraPreco[] {
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

export async function mapaPrecosGold(db: Db): Promise<CursoPreco[]> {
  const rows = await db.query<{ nome: string; preco: number; payload: unknown }>(
    `SELECT cg.nome, cg.preco, cf.payload
       FROM cursos_gold cg
       LEFT JOIN curso_fichas cf ON cf.regime = 'gold' AND cf.curso_id = cg.id`,
  );
  return rows.rows.map(r => ({
    nome: r.nome,
    base: Number(r.preco ?? 0),
    regras: regrasDoPayload(r.payload),
  }));
}

export function precoNoMapa(mapa: CursoPreco[], curso: string, local: string, horario: string) {
  const chave = normPreco(curso);
  if (!chave) return null;
  const hit = mapa.find(c => normPreco(c.nome) === chave);
  if (!hit) return null;
  return escolherPreco(hit.base, local, horario, hit.regras);
}

export async function precoParaOferta(db: Db, curso: string, local: string, horario: string) {
  return precoNoMapa(await mapaPrecosGold(db), curso, local, horario);
}
