-- Avisos da plataforma à equipa (utilizadores, menos formandos e formadores) só saem em horário laboral: segunda a
-- sábado, das 8:30 às 19:00 (Lisboa). Fora disso ficam aqui e saem no início do horário seguinte.
CREATE TABLE IF NOT EXISTS emails_equipa_adiados (
  id bigserial PRIMARY KEY,
  para text NOT NULL,
  nome text NOT NULL DEFAULT '',
  assunto text NOT NULL,
  texto text NOT NULL,
  html text,
  de jsonb,
  anexos jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  enviado_em timestamptz,
  tentativas integer NOT NULL DEFAULT 0,
  erro text
);
CREATE INDEX IF NOT EXISTS emails_equipa_adiados_pendentes ON emails_equipa_adiados (id) WHERE enviado_em IS NULL;
