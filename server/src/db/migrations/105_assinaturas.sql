-- Assinatura de contratos no GesForma: pedido por ligação pessoal, código por email,
-- registo de provas e selo da ENA. Só o PDF assinado vai para a Drive; as provas ficam aqui.

-- Contrato de formação de um formando (os contratos comerciais continuam ligados ao cliente).
ALTER TABLE contratos_comerciais ADD COLUMN IF NOT EXISTS formando_regime text CHECK (formando_regime IN ('gold', 'fin'));
ALTER TABLE contratos_comerciais ADD COLUMN IF NOT EXISTS formando_id integer;
CREATE INDEX IF NOT EXISTS contratos_formando_idx ON contratos_comerciais (formando_regime, formando_id);

-- A equipa da Financiada trata dos contratos de formação dos seus formandos.
DROP POLICY IF EXISTS contratos_isolamento ON contratos_comerciais;
CREATE POLICY contratos_isolamento ON contratos_comerciais USING (app_role() IN ('admin', 'secretaria', 'system') OR (app_role() = 'comercial' AND comercial_id::text = app_user_id()) OR (app_role() = 'financiada' AND formando_regime = 'fin')) WITH CHECK (app_role() IN ('admin', 'secretaria', 'system') OR (app_role() = 'comercial' AND comercial_id::text = app_user_id()) OR (app_role() = 'financiada' AND formando_regime = 'fin'));

CREATE TABLE IF NOT EXISTS contrato_assinaturas (
  id serial PRIMARY KEY,
  contrato_id integer NOT NULL REFERENCES contratos_comerciais(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  codigo_verificacao text NOT NULL UNIQUE,
  estado text NOT NULL DEFAULT 'enviado'
    CHECK (estado IN ('enviado', 'aberto', 'assinado', 'recusado', 'expirado', 'cancelado')),
  titulo text NOT NULL DEFAULT '',
  signatario_nome text NOT NULL,
  signatario_email text NOT NULL,
  signatario_nif_enc text NOT NULL DEFAULT '',
  nif_origem text NOT NULL DEFAULT 'ficha',
  formando_regime text,
  formando_id integer,
  cliente_id integer,
  enviado_por uuid REFERENCES users(id) ON DELETE SET NULL,
  enviado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  aberto_em timestamptz,
  assinado_em timestamptz,
  recusado_em timestamptz,
  cancelado_em timestamptz,
  motivo text NOT NULL DEFAULT '',
  metodo text CHECK (metodo IN ('desenhada', 'escrita', 'cc_cmd')),
  pdf_original bytea NOT NULL,
  hash_original text NOT NULL,
  pdf_assinado bytea,
  hash_assinatura text NOT NULL DEFAULT '',
  hash_final text NOT NULL DEFAULT '',
  certificado_fingerprint text NOT NULL DEFAULT '',
  certificado_titular text NOT NULL DEFAULT '',
  selado boolean NOT NULL DEFAULT false,
  drive_file_id text,
  reenvios integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS contrato_assinaturas_contrato_idx ON contrato_assinaturas (contrato_id, id DESC);
CREATE INDEX IF NOT EXISTS contrato_assinaturas_formando_idx ON contrato_assinaturas (formando_regime, formando_id);

-- Códigos de confirmação (6 dígitos, guardados em hash, 10 minutos, 5 tentativas).
CREATE TABLE IF NOT EXISTS assinatura_codigos (
  id serial PRIMARY KEY,
  assinatura_id integer NOT NULL REFERENCES contrato_assinaturas(id) ON DELETE CASCADE,
  codigo_hash text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  tentativas integer NOT NULL DEFAULT 0,
  usado_em timestamptz
);

CREATE INDEX IF NOT EXISTS assinatura_codigos_idx ON assinatura_codigos (assinatura_id, id DESC);

-- Registo de provas: cada passo com data, IP e navegador.
CREATE TABLE IF NOT EXISTS assinatura_eventos (
  id serial PRIMARY KEY,
  assinatura_id integer NOT NULL REFERENCES contrato_assinaturas(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  em timestamptz NOT NULL DEFAULT now(),
  ip text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  detalhe jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS assinatura_eventos_idx ON assinatura_eventos (assinatura_id, id);

-- Certificado do selo da ENA (PKCS#12 cifrado). Uma só linha.
CREATE TABLE IF NOT EXISTS assinatura_selo (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  p12_enc text NOT NULL,
  senha_enc text NOT NULL,
  titular text NOT NULL DEFAULT '',
  emissor text NOT NULL DEFAULT '',
  fingerprint text NOT NULL DEFAULT '',
  valido_de timestamptz,
  valido_ate timestamptz,
  auto_assinado boolean NOT NULL DEFAULT false,
  actualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE contrato_assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE contrato_assinaturas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON contrato_assinaturas;
CREATE POLICY gesforma_api ON contrato_assinaturas FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE assinatura_codigos ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinatura_codigos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON assinatura_codigos;
CREATE POLICY gesforma_api ON assinatura_codigos FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE assinatura_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinatura_eventos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON assinatura_eventos;
CREATE POLICY gesforma_api ON assinatura_eventos FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE assinatura_selo ENABLE ROW LEVEL SECURITY;
ALTER TABLE assinatura_selo FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON assinatura_selo;
CREATE POLICY gesforma_api ON assinatura_selo FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');
