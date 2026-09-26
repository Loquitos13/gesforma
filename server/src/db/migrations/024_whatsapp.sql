CREATE TABLE IF NOT EXISTS whatsapp_sessoes (
  telefone text PRIMARY KEY,
  passo text NOT NULL DEFAULT 'menu',
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  lead_id integer,
  actualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_mensagens (
  id bigserial PRIMARY KEY,
  telefone text NOT NULL,
  direccao text NOT NULL CHECK (direccao IN ('in', 'out')),
  corpo text NOT NULL,
  wamid text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_mensagens_tel_idx
  ON whatsapp_mensagens (telefone, created_at DESC);
