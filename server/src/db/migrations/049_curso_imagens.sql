CREATE TABLE IF NOT EXISTS curso_imagens (
  regime text NOT NULL CHECK (regime IN ('gold', 'fin')),
  curso_id integer NOT NULL,
  slot text NOT NULL CHECK (slot IN ('banner', 'thumb')),
  nome text NOT NULL DEFAULT '',
  mime text NOT NULL DEFAULT 'image/jpeg',
  bytes bytea NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (regime, curso_id, slot)
);
