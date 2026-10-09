import type { Db } from "./db/pool.js";
import { precoDaInscricao, type EscolhaPreco, type RegraPreco } from "./precoInscricao.js";

function objecto(payload: unknown): Record<string, unknown> | null {
  if (!payload) return null;
  if (typeof payload === "string") {
    try {
      const v = JSON.parse(payload) as unknown;
      return v && typeof v === "object" ? v as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
  if (typeof payload === "object") return payload as Record<string, unknown>;
  return null;
}

export function regraDePayload(payload: unknown): RegraPreco | null {
  const o = objecto(payload);
  if (!o) return null;
  const curso = String(o.curso ?? "").trim();
  if (!curso) return null;
  return {
    curso,
    local: String(o.local ?? ""),
    horario: String(o.horario ?? ""),
    inicio: String(o.inicio ?? ""),
    preco: Number(o.preco ?? 0),
    status: String(o.status ?? ""),
  };
}

export async function listRegrasPrecoGold(db: Db): Promise<RegraPreco[]> {
  const datas = await db.query<{ payload: unknown }>(
    "SELECT payload FROM catalog_items WHERE kind = 'datas' AND regime = 'gold'",
  );
  return datas.rows.map(r => regraDePayload(r.payload)).filter((r): r is RegraPreco => !!r);
}

/** Preço Gold gravado na inscrição: edição (local, horário ou ambos) e, se não houver, o da ficha do curso. */
export async function precoInscricaoNaBase(db: Db, escolha: EscolhaPreco) {
  const [cursos, regras] = await Promise.all([
    db.query<{ nome: string; preco: number }>("SELECT nome, preco FROM cursos_gold"),
    listRegrasPrecoGold(db),
  ]);
  return precoDaInscricao(
    cursos.rows.map(c => ({ nome: c.nome, preco: Number(c.preco) })),
    regras,
    escolha,
  );
}
