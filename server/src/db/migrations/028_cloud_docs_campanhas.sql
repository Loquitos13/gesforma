ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS fim text NOT NULL DEFAULT '';
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS canal text NOT NULL DEFAULT '';
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS notas text NOT NULL DEFAULT '';

ALTER TABLE formando_docs ADD COLUMN IF NOT EXISTS drive_file_id text NOT NULL DEFAULT '';
ALTER TABLE formando_docs ADD COLUMN IF NOT EXISTS drive_url text NOT NULL DEFAULT '';

ALTER TABLE formador_docs ADD COLUMN IF NOT EXISTS drive_file_id text NOT NULL DEFAULT '';
ALTER TABLE formador_docs ADD COLUMN IF NOT EXISTS drive_url text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS dtp_anexos (
  regime text NOT NULL CHECK (regime IN ('gold', 'fin')),
  turma_id integer NOT NULL,
  item_id text NOT NULL,
  drive_file_id text NOT NULL DEFAULT '',
  file_name text NOT NULL DEFAULT '',
  drive_url text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (regime, turma_id, item_id)
);
