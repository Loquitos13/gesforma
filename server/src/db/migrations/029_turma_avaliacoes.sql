CREATE TABLE IF NOT EXISTS turma_avaliacoes (
  regime text NOT NULL CHECK (regime IN ('gold', 'fin')),
  turma_id integer NOT NULL,
  formando_id integer NOT NULL,
  modulo_id text NOT NULL DEFAULT '',
  parametro_id text NOT NULL,
  nota numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (regime, turma_id, formando_id, modulo_id, parametro_id)
);
