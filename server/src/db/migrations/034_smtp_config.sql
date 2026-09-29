CREATE TABLE IF NOT EXISTS smtp_config (
  id text PRIMARY KEY,
  host text NOT NULL DEFAULT 'smtp-relay.brevo.com',
  port integer NOT NULL DEFAULT 587,
  login text NOT NULL DEFAULT '',
  password_sealed text,
  from_name text NOT NULL DEFAULT 'ENA Formação',
  from_email text NOT NULL DEFAULT '',
  reply_to text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
