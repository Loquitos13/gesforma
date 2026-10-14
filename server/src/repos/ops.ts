/** Identificadores partilhados (sequência comum dos registos operacionais). */
import { valor, type Consulta } from "./sql.js";

/** Próximo id da sequência comum (`ops_id_seq`). */
export async function proximoIdOps(c: Consulta): Promise<number | null> {
  const id = await valor<number>(c, "SELECT nextval('ops_id_seq')::int AS id");
  return id == null ? null : Number(id);
}
