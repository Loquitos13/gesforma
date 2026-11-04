-- WhatsApp: fechar conversas (a equipa ou a regra de inatividade) e lembretes por inatividade.
ALTER TABLE whatsapp_sessoes ADD COLUMN IF NOT EXISTS fechada_em timestamptz;
ALTER TABLE whatsapp_sessoes ADD COLUMN IF NOT EXISTS fechada_por text;
-- Lembrete «ainda está aí?» à pessoa que parou a meio (um por pausa).
ALTER TABLE whatsapp_sessoes ADD COLUMN IF NOT EXISTS lembrete_em timestamptz;
-- Novo aviso à equipa quando um pedido para falar com a equipa fica sem resposta (um por pedido).
ALTER TABLE whatsapp_sessoes ADD COLUMN IF NOT EXISTS aviso_equipa_em timestamptz;
-- Marcas no histórico («Conversa fechada por …», «Conversa reaberta»): não são mensagens enviadas nem recebidas.
ALTER TABLE whatsapp_mensagens DROP CONSTRAINT IF EXISTS whatsapp_mensagens_direccao_check;
ALTER TABLE whatsapp_mensagens ADD CONSTRAINT whatsapp_mensagens_direccao_check CHECK (direccao IN ('in', 'out', 'evento'));
-- O aviso à equipa de um pedido para falar com a equipa espera pela mensagem seguinte da pessoa (o assunto, que o
-- assistente lhe pede) ou, sem ela, uns minutos: fica aqui quando saiu.
ALTER TABLE whatsapp_sessoes ADD COLUMN IF NOT EXISTS aviso_pedido_em timestamptz;
-- O aviso à equipa leva o assunto (a mensagem que a pessoa escreve a seguir ao pedido), não a opção tocada.
UPDATE email_templates
   SET body_xml = replace(body_xml, 'Última mensagem: {{mensagem}}', 'Assunto: {{mensagem}}'),
       body_lines = replace(body_lines::text, 'Última mensagem: {{mensagem}}', 'Assunto: {{mensagem}}')::jsonb,
       updated_at = now()
 WHERE tipo = 'aviso_whatsapp_humano' AND body_xml LIKE '%Última mensagem: {{mensagem}}%';
