ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS turma_id integer;
CREATE INDEX IF NOT EXISTS formandos_fin_turma_idx ON formandos_fin (turma_id);
