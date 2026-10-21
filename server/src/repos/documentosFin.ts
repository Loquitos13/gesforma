/** Leituras dos documentos da turma da Financiada (ficha de inscrição, plano de sessão, folha de presenças / sumário). */
import { one, type Consulta } from "./sql.js";

/** A turma do formando: pelo id ou, nas fichas antigas sem id, pelo nome da turma. */
export function turmaDoFormandoFin(c: Consulta, formandoId: number) {
  return one<{ turma_id: number | null }>(
    c,
    `SELECT COALESCE(f.turma_id, t.id) AS turma_id
       FROM formandos_fin f
       LEFT JOIN LATERAL (
         SELECT id FROM turmas_fin
          WHERE f.turma_id IS NULL AND trim(f.turma) <> '' AND lower(trim(nome)) = lower(trim(f.turma))
          ORDER BY id LIMIT 1
       ) t ON true
      WHERE f.id = $1`,
    [formandoId],
  );
}
