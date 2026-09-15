CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'secretaria')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_exp_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS email_templates (
  id serial PRIMARY KEY,
  tipo text NOT NULL UNIQUE,
  nome text NOT NULL,
  assunto text NOT NULL,
  body_lines jsonb NOT NULL DEFAULT '[]',
  cta text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS email_rules (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  trigger_key text NOT NULL,
  gatilho_label text NOT NULL,
  template_tipo text NOT NULL REFERENCES email_templates(tipo),
  delay_seconds integer NOT NULL DEFAULT 0 CHECK (delay_seconds >= 0 AND delay_seconds <= 2592000),
  curso text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS email_rules_trigger_idx ON email_rules (trigger_key, ativo);

CREATE TABLE IF NOT EXISTS automation_events (
  id uuid PRIMARY KEY,
  type text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_events_type_idx ON automation_events (type, created_at DESC);

CREATE TABLE IF NOT EXISTS email_jobs (
  id uuid PRIMARY KEY,
  rule_id integer NOT NULL REFERENCES email_rules(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES automation_events(id) ON DELETE CASCADE,
  to_email text NOT NULL,
  to_name text NOT NULL,
  subject text NOT NULL,
  body_text text NOT NULL,
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  sent_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, event_id)
);

CREATE INDEX IF NOT EXISTS email_jobs_due_idx ON email_jobs (scheduled_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS email_jobs_status_idx ON email_jobs (status, sent_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor_id uuid,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text,
  ip text,
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);
