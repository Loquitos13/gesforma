CREATE TABLE IF NOT EXISTS drive_config (
  id text PRIMARY KEY,
  client_id text,
  client_secret text,
  folder_id text,
  folder_name text,
  scope text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
