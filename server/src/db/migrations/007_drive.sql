CREATE TABLE IF NOT EXISTS oauth_accounts (
  provider text PRIMARY KEY,
  email text,
  access_token text NOT NULL,
  refresh_token text,
  expiry timestamptz,
  scope text,
  folder_id text,
  folder_name text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  meta jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS oauth_states (
  state text PRIMARY KEY,
  user_id text NOT NULL,
  redirect_to text,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS drive_files (
  id text PRIMARY KEY,
  drive_id text,
  name text NOT NULL,
  mime_type text,
  size_bytes integer,
  web_view_link text,
  web_content_link text,
  folder_path text,
  kind text NOT NULL DEFAULT 'documento',
  regime text,
  turma text,
  formando text,
  label text,
  stored_in text NOT NULL DEFAULT 'local',
  local_path text,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS drive_files_ctx_idx ON drive_files (kind, regime, turma);
CREATE INDEX IF NOT EXISTS drive_files_formando_idx ON drive_files (formando);
