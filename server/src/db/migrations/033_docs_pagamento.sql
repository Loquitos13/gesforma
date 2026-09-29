ALTER TABLE preinscricao_docs ADD COLUMN IF NOT EXISTS drive_url text NOT NULL DEFAULT '';

ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS pagamento_id text;
CREATE INDEX IF NOT EXISTS preinscricoes_pagamento_idx
  ON preinscricoes (pagamento_id) WHERE pagamento_id IS NOT NULL;
