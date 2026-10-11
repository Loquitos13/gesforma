CREATE TABLE IF NOT EXISTS blog_imagens (
  token text PRIMARY KEY,
  nome text NOT NULL DEFAULT '',
  mime text NOT NULL DEFAULT 'image/jpeg',
  bytes bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
