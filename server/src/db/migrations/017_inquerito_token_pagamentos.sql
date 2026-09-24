ALTER TABLE catalog_items ADD COLUMN IF NOT EXISTS public_token text;
CREATE UNIQUE INDEX IF NOT EXISTS catalog_items_public_token_idx
  ON catalog_items (public_token) WHERE public_token IS NOT NULL;

ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS referencia text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS pagamentos_referencia_idx ON pagamentos (referencia);
CREATE INDEX IF NOT EXISTS pagamentos_email_idx ON pagamentos (email);
