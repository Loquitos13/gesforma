ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS cronograma_publicado_em timestamptz;
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS cronograma_publicado_em timestamptz;
