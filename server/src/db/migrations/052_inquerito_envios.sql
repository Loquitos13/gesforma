CREATE TABLE IF NOT EXISTS inquerito_envios (
  id serial PRIMARY KEY,
  regime text NOT NULL,
  turma_id integer NOT NULL,
  inquerito_id integer NOT NULL,
  publico text NOT NULL DEFAULT 'formando',
  enviado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (regime, turma_id, inquerito_id)
);

CREATE INDEX IF NOT EXISTS inquerito_envios_turma_idx ON inquerito_envios (regime, turma_id);

ALTER TABLE inquerito_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE inquerito_envios FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON inquerito_envios;
CREATE POLICY gesforma_api ON inquerito_envios FOR ALL
  USING (current_setting('gesforma.api', true) = '1')
  WITH CHECK (current_setting('gesforma.api', true) = '1');
