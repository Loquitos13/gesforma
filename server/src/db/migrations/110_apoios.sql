-- Apoios aos formandos da Financiada (bolsa, alimentação, transporte, acolhimento, alojamento).
-- As regras variam por operação/financiador: ficam configuráveis, com regra geral (financiador ''),
-- regra do financiador e, por cima, regra própria de uma turma.

CREATE TABLE IF NOT EXISTS apoio_regras (
  id serial PRIMARY KEY,
  financiador text NOT NULL DEFAULT '',
  turma_id integer,
  tipo text NOT NULL CHECK (tipo IN ('bolsa', 'alimentacao', 'transporte', 'acolhimento', 'alojamento')),
  ativo boolean NOT NULL DEFAULT true,
  -- hora: valor × horas presentes; dia: valor × dias com o mínimo de horas; mes: valor fixo no mês com presença.
  modo text NOT NULL CHECK (modo IN ('hora', 'dia', 'mes')),
  valor numeric(10, 2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  min_horas_dia numeric(5, 2) NOT NULL DEFAULT 0 CHECK (min_horas_dia >= 0),
  teto_mensal numeric(10, 2) CHECK (teto_mensal IS NULL OR teto_mensal >= 0),
  assiduidade_minima numeric(5, 2) CHECK (assiduidade_minima IS NULL OR (assiduidade_minima >= 0 AND assiduidade_minima <= 100)),
  requer_iban boolean NOT NULL DEFAULT true,
  notas text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS apoio_regras_ambito_tipo
  ON apoio_regras (financiador, COALESCE(turma_id, 0), tipo);

-- IBAN do formando para receber os apoios (cifrado com fieldCrypto).
CREATE TABLE IF NOT EXISTS formando_apoio_dados (
  formando_id integer PRIMARY KEY,
  iban_enc text NOT NULL DEFAULT '',
  titular text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Apoio processado por formando, mês (YYYY-MM) e tipo.
CREATE TABLE IF NOT EXISTS apoios (
  id serial PRIMARY KEY,
  formando_id integer NOT NULL,
  turma_id integer NOT NULL,
  periodo text NOT NULL CHECK (periodo ~ '^\d{4}-\d{2}$'),
  tipo text NOT NULL CHECK (tipo IN ('bolsa', 'alimentacao', 'transporte', 'acolhimento', 'alojamento')),
  dias integer NOT NULL DEFAULT 0,
  horas numeric(8, 2) NOT NULL DEFAULT 0,
  valor_calculado numeric(10, 2) NOT NULL DEFAULT 0,
  ajuste numeric(10, 2) NOT NULL DEFAULT 0,
  motivo_ajuste text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'calculado' CHECK (estado IN ('calculado', 'aprovado', 'pago', 'anulado')),
  detalhe jsonb NOT NULL DEFAULT '{}',
  pago_em date,
  referencia text NOT NULL DEFAULT '',
  notas text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE (formando_id, periodo, tipo)
);

CREATE INDEX IF NOT EXISTS apoios_turma_periodo ON apoios (turma_id, periodo);
CREATE INDEX IF NOT EXISTS apoios_estado ON apoios (estado);

-- Só a equipa da Financiada (e o sistema) lê ou escreve apoios e IBAN dos formandos.
ALTER TABLE apoio_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE apoio_regras FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apoio_regras_equipa ON apoio_regras;
CREATE POLICY apoio_regras_equipa ON apoio_regras
  USING (app_role() IN ('admin', 'secretaria', 'financiada', 'system'))
  WITH CHECK (app_role() IN ('admin', 'secretaria', 'financiada', 'system'));

ALTER TABLE formando_apoio_dados ENABLE ROW LEVEL SECURITY;
ALTER TABLE formando_apoio_dados FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS formando_apoio_dados_equipa ON formando_apoio_dados;
CREATE POLICY formando_apoio_dados_equipa ON formando_apoio_dados
  USING (app_role() IN ('admin', 'secretaria', 'financiada', 'system'))
  WITH CHECK (app_role() IN ('admin', 'secretaria', 'financiada', 'system'));

ALTER TABLE apoios ENABLE ROW LEVEL SECURITY;
ALTER TABLE apoios FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS apoios_equipa ON apoios;
CREATE POLICY apoios_equipa ON apoios
  USING (app_role() IN ('admin', 'secretaria', 'financiada', 'system'))
  WITH CHECK (app_role() IN ('admin', 'secretaria', 'financiada', 'system'));
