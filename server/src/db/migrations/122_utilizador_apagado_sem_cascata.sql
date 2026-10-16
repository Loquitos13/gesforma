-- Eliminar um utilizador apaga a conta, mas não os documentos comerciais que ele criou:
-- propostas, contratos e interesses ficam, com comercial_id a NULL ("sem comercial").
-- O RLS (048) já só mostra ao comercial as linhas com o seu id; as órfãs ficam para admin e secretaria.
ALTER TABLE propostas_comerciais ALTER COLUMN comercial_id DROP NOT NULL;
ALTER TABLE propostas_comerciais DROP CONSTRAINT IF EXISTS propostas_comerciais_comercial_id_fkey;
ALTER TABLE propostas_comerciais ADD CONSTRAINT propostas_comerciais_comercial_id_fkey
  FOREIGN KEY (comercial_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE contratos_comerciais ALTER COLUMN comercial_id DROP NOT NULL;
ALTER TABLE contratos_comerciais DROP CONSTRAINT IF EXISTS contratos_comerciais_comercial_id_fkey;
ALTER TABLE contratos_comerciais ADD CONSTRAINT contratos_comerciais_comercial_id_fkey
  FOREIGN KEY (comercial_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE cliente_interesses ALTER COLUMN comercial_id DROP NOT NULL;
ALTER TABLE cliente_interesses DROP CONSTRAINT IF EXISTS cliente_interesses_comercial_id_fkey;
ALTER TABLE cliente_interesses ADD CONSTRAINT cliente_interesses_comercial_id_fkey
  FOREIGN KEY (comercial_id) REFERENCES users(id) ON DELETE SET NULL;
