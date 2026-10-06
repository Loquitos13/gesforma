import type { Db } from "./db/pool.js";

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

/** Rótulos M1/C1 tal como estão gravados na ficha do curso. Sem catálogo paralelo. */
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
    const codigo = `${livre ? "C" : "M"}${i + 1}`;
    out.push(horas ? `${codigo} · ${titulo} · ${horas}` : `${codigo} · ${titulo}`);
  });
  return out;
}

export async function modulosDaFicha(db: Db, regime: "gold" | "fin", curso: string): Promise<string[]> {
  const nome = curso.trim();
  if (!nome) return [];
  const row = regime === "fin"
    ? await db.query<{ payload: unknown }>(
      `SELECT f.payload
         FROM curso_fichas f
         JOIN cursos_fin c ON c.id = f.curso_id AND f.regime = 'fin'
        WHERE lower(trim(c.nome_comercial)) = lower(trim($1))
           OR lower(trim(c.ufcd)) = lower(trim($1))
           OR c.ufcd_cod = $1
        LIMIT 1`,
      [nome],
    )
    : await db.query<{ payload: unknown }>(
      `SELECT f.payload
         FROM curso_fichas f
         JOIN cursos_gold c ON c.id = f.curso_id AND f.regime = 'gold'
        WHERE lower(trim(c.nome)) = lower(trim($1))
        LIMIT 1`,
      [nome],
    );
  return labelsDePayload(row.rows[0]?.payload);
}
