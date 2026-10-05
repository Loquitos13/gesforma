ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'secretaria', 'comercial', 'financiada', 'formador'));

ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS formadores jsonb NOT NULL DEFAULT '[]';
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS formadores jsonb NOT NULL DEFAULT '[]';
ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS drive_pasta_id text NOT NULL DEFAULT '';
ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS drive_dossie_id text NOT NULL DEFAULT '';
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS drive_pasta_id text NOT NULL DEFAULT '';
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS drive_dossie_id text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS comercial_objetivos (
  comercial_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  meta_pct numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS proposta_templates (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  curso text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  corpo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contrato_templates (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  curso text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  corpo text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_clientes (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  email text NOT NULL DEFAULT '',
  telf text NOT NULL DEFAULT '',
  nif text NOT NULL DEFAULT '',
  notas text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_parceiros (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  email text NOT NULL DEFAULT '',
  telf text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT '',
  notas text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE propostas_comerciais ADD COLUMN IF NOT EXISTS corpo text NOT NULL DEFAULT '';
ALTER TABLE contratos_comerciais ADD COLUMN IF NOT EXISTS corpo text NOT NULL DEFAULT '';
ALTER TABLE contratos_comerciais ADD COLUMN IF NOT EXISTS template_id integer;
