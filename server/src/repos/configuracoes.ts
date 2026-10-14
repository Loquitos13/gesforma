import { one, type Consulta } from "./sql.js";

/** Definições guardadas em `app_settings` (valores em texto, uma linha por chave). */
export async function valoresDefinicao(c: Consulta, id: string) {
  const r = await one<{ values: Record<string, unknown> }>(c, "SELECT values FROM app_settings WHERE id = $1", [id]);
  return r?.values ?? {};
}
