/** Definições (`app_settings`): cada id guarda um objecto de valores. */
import { many, one, type Consulta } from "./sql.js";

export async function todasDefinicoes(c: Consulta) {
  const linhas = await many<{ id: string; values: Record<string, unknown> }>(c, "SELECT id, values FROM app_settings");
  return Object.fromEntries(linhas.map(r => [r.id, r.values ?? {}])) as Record<string, Record<string, unknown>>;
}

export async function lerDefinicao(c: Consulta, id: string): Promise<Record<string, unknown>> {
  const r = await one<{ values: unknown }>(c, "SELECT values FROM app_settings WHERE id = $1", [id]);
  const v = r?.values;
  return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
}

export async function gravarDefinicao(c: Consulta, id: string, values: Record<string, unknown>) {
  await many(c,
    `INSERT INTO app_settings (id, values) VALUES ($1, $2::jsonb)
     ON CONFLICT (id) DO UPDATE SET values = EXCLUDED.values, updated_at = now()`,
    [id, values]);
}
