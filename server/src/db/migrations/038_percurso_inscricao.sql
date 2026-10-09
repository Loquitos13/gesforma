ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS inscricoes_adicionais integer NOT NULL DEFAULT 0;
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS inscricoes_adicionais integer NOT NULL DEFAULT 0;
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS percurso_turma_id integer;
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS percurso_concluido_em timestamptz;
CREATE INDEX IF NOT EXISTS preinscricoes_percurso_turma_idx
  ON preinscricoes (percurso_turma_id) WHERE percurso_turma_id IS NOT NULL;
