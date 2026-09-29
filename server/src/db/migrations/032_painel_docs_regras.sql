ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS docs_token text;
CREATE UNIQUE INDEX IF NOT EXISTS preinscricoes_docs_token_idx
  ON preinscricoes (docs_token) WHERE docs_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS preinscricao_docs (
  id serial PRIMARY KEY,
  preinscricao_id integer NOT NULL REFERENCES preinscricoes(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT '',
  nome text NOT NULL DEFAULT '',
  drive_file_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS preinscricao_docs_lead_idx ON preinscricao_docs (preinscricao_id, created_at DESC);

CREATE TABLE IF NOT EXISTS turma_regras (
  id serial PRIMARY KEY,
  regime text NOT NULL DEFAULT 'gold',
  curso text NOT NULL DEFAULT '',
  local text NOT NULL DEFAULT '',
  horario text NOT NULL DEFAULT '',
  vagas integer NOT NULL DEFAULT 16,
  horas integer NOT NULL DEFAULT 25,
  horas_sessao numeric NOT NULL DEFAULT 3,
  formador text NOT NULL DEFAULT '',
  proxima_data text NOT NULL DEFAULT '',
  nome_prefixo text NOT NULL DEFAULT '',
  activa boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS turma_regras_regime_idx ON turma_regras (regime, activa);
