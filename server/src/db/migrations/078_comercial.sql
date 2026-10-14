-- Comercial (clientes, propostas, contratos, equipa, campanhas): colunas e índices das listas novas.

-- Modelo usado em cada proposta (para contar os usos de cada modelo).
ALTER TABLE propostas_comerciais ADD COLUMN IF NOT EXISTS template_id integer;

-- Contratos: última alteração.
ALTER TABLE contratos_comerciais ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Modelos: última alteração.
ALTER TABLE proposta_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE contrato_templates ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS propostas_cliente_idx ON propostas_comerciais (cliente_id);
CREATE INDEX IF NOT EXISTS propostas_template_idx ON propostas_comerciais (template_id);
CREATE INDEX IF NOT EXISTS contratos_cliente_idx ON contratos_comerciais (cliente_id);
CREATE INDEX IF NOT EXISTS contratos_template_idx ON contratos_comerciais (template_id);
CREATE INDEX IF NOT EXISTS preinscricoes_comercial_criada_idx ON preinscricoes (comercial_id, created_at);
