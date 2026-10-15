-- Clientes: empresa ou particular (o histórico de vendas junta contratos e inscrições com o mesmo email).
ALTER TABLE crm_clientes ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'Empresa';
ALTER TABLE crm_clientes DROP CONSTRAINT IF EXISTS crm_clientes_tipo_check;
ALTER TABLE crm_clientes ADD CONSTRAINT crm_clientes_tipo_check CHECK (tipo IN ('Empresa', 'Particular'));
