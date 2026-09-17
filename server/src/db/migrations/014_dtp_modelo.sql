CREATE TABLE IF NOT EXISTS curso_dtp_modelos (
  regime text NOT NULL CHECK (regime IN ('gold', 'fin')),
  curso_id integer NOT NULL,
  excluidos jsonb NOT NULL DEFAULT '[]',
  extra jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (regime, curso_id)
);
