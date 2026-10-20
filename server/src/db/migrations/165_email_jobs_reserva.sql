-- Fila de emails com reserva: quem vai enviar marca o envio como «sending» (com a hora) numa só instrução,
-- para que o cron, o fim de um evento ou uma pré-inscrição pública a correr ao mesmo tempo não enviem o mesmo email duas vezes.
ALTER TABLE email_jobs ADD COLUMN IF NOT EXISTS claimed_at timestamptz;
ALTER TABLE email_jobs DROP CONSTRAINT IF EXISTS email_jobs_status_check;
ALTER TABLE email_jobs ADD CONSTRAINT email_jobs_status_check CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled'));
CREATE INDEX IF NOT EXISTS email_jobs_sending_idx ON email_jobs (claimed_at) WHERE status = 'sending';
