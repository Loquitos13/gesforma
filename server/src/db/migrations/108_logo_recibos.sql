-- Logótipo da entidade (um só registo) e recibos internos de pagamento com numeração anual.
CREATE TABLE IF NOT EXISTS entidade_logo (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome text NOT NULL DEFAULT '',
  mime text NOT NULL,
  bytes bytea NOT NULL,
  hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Contador por ano: o incremento é uma só instrução (INSERT … ON CONFLICT … RETURNING), por isso não há números repetidos.
CREATE TABLE IF NOT EXISTS recibo_sequencias (
  ano integer PRIMARY KEY,
  ultimo integer NOT NULL DEFAULT 0
);

-- Um recibo por pagamento. Sem chave estrangeira: o número emitido fica registado mesmo que o pagamento seja apagado.
CREATE TABLE IF NOT EXISTS recibos (
  id serial PRIMARY KEY,
  pagamento_id text NOT NULL UNIQUE,
  ano integer NOT NULL,
  numero integer NOT NULL,
  emitido_em timestamptz NOT NULL DEFAULT now(),
  emitido_por uuid,
  actualizado_em timestamptz NOT NULL DEFAULT now(),
  drive_file_id text NOT NULL DEFAULT '',
  enviado_em timestamptz,
  enviado_para text NOT NULL DEFAULT '',
  dados jsonb NOT NULL DEFAULT '{}',
  UNIQUE (ano, numero)
);

-- Modelo do email que acompanha o recibo (editável em Sistema › Emails › Modelos).
INSERT INTO email_templates (tipo, nome, assunto, body_lines, cta)
VALUES (
  'recibo',
  'Recibo de pagamento',
  'Recibo de pagamento · {{curso}}',
  '["Confirmamos a receção do seu pagamento de {{valor}} referente a {{curso}}.", "Segue em anexo o recibo n.º {{numero}}.", "Este recibo é um documento interno e não substitui a fatura."]'::jsonb,
  ''
)
ON CONFLICT (tipo) DO NOTHING;
