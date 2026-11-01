import type { Db } from "./db/pool.js";
import { cursosGoldComFicha } from "./repos/oferta.js";
import { escolherPreco, normPreco, type RegraPreco } from "../../src/partilhado/precoLocal.js";

export { escolherPreco, normPreco, type RegraPreco };

type CursoPreco = { nome: string; base: number; regras: RegraPreco[] };

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
  const rows = await cursosGoldComFicha(db);
  return rows.map(r => ({
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
