/** Ficha individual de avaliação da aprendizagem (qualitativa): uma linha por formando; a 0 é a da turma. */
import { many, one, type Consulta, type Regime } from "./sql.js";

export type CriterioQualitativo = { nivel: number | null; texto: string };
export type DadosQualitativos = {
  competencias?: string;
  aquisicao?: CriterioQualitativo;
  autonomiaAprendizagens?: CriterioQualitativo;
  autonomiaProblemas?: CriterioQualitativo;
};

export async function listarQualitativas(c: Consulta, regime: Regime, turmaId: number) {
  return many<{ formando_id: number; dados: DadosQualitativos; atualizado_por: string; atualizado_em: string }>(c,
    `SELECT formando_id, dados, atualizado_por, atualizado_em::text AS atualizado_em
       FROM avaliacao_qualitativa WHERE regime = $1 AND turma_id = $2 ORDER BY formando_id`, [regime, turmaId]);
}

export async function gravarQualitativa(c: Consulta, regime: Regime, turmaId: number, formandoId: number, dados: DadosQualitativos, quem: string) {
  await one(c,
    `INSERT INTO avaliacao_qualitativa (regime, turma_id, formando_id, dados, atualizado_por, atualizado_em)
     VALUES ($1, $2, $3, $4::jsonb, $5, now())
     ON CONFLICT (regime, turma_id, formando_id) DO UPDATE SET dados = EXCLUDED.dados, atualizado_por = EXCLUDED.atualizado_por, atualizado_em = now()
     RETURNING formando_id`, [regime, turmaId, formandoId, dados, quem]);
}
