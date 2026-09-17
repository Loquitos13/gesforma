CREATE TABLE IF NOT EXISTS microsoft_config (
  id text PRIMARY KEY,
  client_id text,
  client_secret text,
  tenant_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
