CREATE TABLE IF NOT EXISTS whatsapp_config (
  id text PRIMARY KEY,
  token_sealed text,
  phone_id text NOT NULL DEFAULT '',
  verify_token text NOT NULL DEFAULT '',
  display_phone text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
