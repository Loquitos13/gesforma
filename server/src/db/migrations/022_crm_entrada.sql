ALTER TABLE preinscricoes
  ADD COLUMN IF NOT EXISTS entrada text NOT NULL DEFAULT 'preinscricao';

UPDATE preinscricoes
   SET entrada = 'manual'
 WHERE entrada = 'preinscricao'
   AND lower(origem) IN ('manual', 'telefone', 'whatsapp', 'email', 'balcão', 'balcao', 'indicação', 'indicacao');

CREATE INDEX IF NOT EXISTS preinscricoes_entrada_idx ON preinscricoes (entrada, created_at DESC);
