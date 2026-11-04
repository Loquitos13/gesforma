-- Ficheiros que as pessoas enviam no WhatsApp: ficam aqui (vistos na caixa de conversas) e só passam para a ficha da
-- pré-inscrição quando alguém da equipa confirma («Guardar na ficha»). Os não guardados apagam-se ao fim de 30 dias.
CREATE TABLE IF NOT EXISTS whatsapp_anexos (
  id bigserial PRIMARY KEY,
  telefone text NOT NULL,
  wamid text,
  nome text NOT NULL,
  mime text NOT NULL,
  tamanho integer NOT NULL,
  conteudo bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  guardado_em timestamptz,
  guardado_por text,
  preinscricao_id integer,
  doc_tipo text
);
CREATE INDEX IF NOT EXISTS whatsapp_anexos_tel_idx ON whatsapp_anexos (telefone, created_at DESC);
ALTER TABLE whatsapp_mensagens ADD COLUMN IF NOT EXISTS anexo_id bigint;

ALTER TABLE whatsapp_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_anexos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON whatsapp_anexos;
CREATE POLICY gesforma_api ON whatsapp_anexos FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');
