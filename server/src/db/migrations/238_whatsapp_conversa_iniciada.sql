-- Quando começou a conversa actual (primeira mensagem, ou a pessoa voltou a escrever numa conversa fechada): alerta
-- «nova conversa» no GesForma até alguém a abrir.
ALTER TABLE whatsapp_sessoes ADD COLUMN IF NOT EXISTS conversa_iniciada_em timestamptz;
