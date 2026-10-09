ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS drive_pasta_id text NOT NULL DEFAULT '';
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS drive_pasta_parent_id text NOT NULL DEFAULT '';

ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS drive_formandos_id text NOT NULL DEFAULT '';
ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS drive_formadores_id text NOT NULL DEFAULT '';
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS drive_formandos_id text NOT NULL DEFAULT '';
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS drive_formadores_id text NOT NULL DEFAULT '';

ALTER TABLE formadores ADD COLUMN IF NOT EXISTS drive_pasta_id text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS formador_atalhos (
  id serial PRIMARY KEY,
  formador_id integer NOT NULL,
  regime text NOT NULL,
  turma_id integer NOT NULL,
  doc_id text NOT NULL DEFAULT '',
  drive_file_id text NOT NULL DEFAULT '',
  shortcut_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formador_id, regime, turma_id, doc_id)
);

ALTER TABLE formador_atalhos ENABLE ROW LEVEL SECURITY;
ALTER TABLE formador_atalhos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON formador_atalhos;
CREATE POLICY gesforma_api ON formador_atalhos FOR ALL
  USING (current_setting('gesforma.api', true) = '1')
  WITH CHECK (current_setting('gesforma.api', true) = '1');
