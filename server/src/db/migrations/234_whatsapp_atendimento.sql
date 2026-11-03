-- Atendimento humano no WhatsApp: a pessoa pede para falar com alguém da equipa, o bot fica em pausa nessa conversa e a
-- equipa responde pela caixa de conversas do CRM (dentro das 24 horas da última mensagem da pessoa, regra da Meta).
ALTER TABLE whatsapp_sessoes ADD COLUMN IF NOT EXISTS humano_desde timestamptz;
ALTER TABLE whatsapp_sessoes ADD COLUMN IF NOT EXISTS humano_por text;
ALTER TABLE whatsapp_sessoes ADD COLUMN IF NOT EXISTS lida_em timestamptz;
ALTER TABLE whatsapp_sessoes ADD COLUMN IF NOT EXISTS nome_perfil text;
-- Quem escreveu a mensagem de saída: vazio é o bot; senão, o nome de quem respondeu na caixa de conversas.
ALTER TABLE whatsapp_mensagens ADD COLUMN IF NOT EXISTS autor text;

-- Aviso à equipa (editável em Sistema › Emails › Modelos).
INSERT INTO email_templates (tipo, area, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito)
SELECT 'aviso_whatsapp_humano', a.area, 'WhatsApp · pedido para falar com a equipa (aviso à equipa)',
  'WhatsApp: {{nome_contacto}} quer falar com a equipa',
  '["{{nome_contacto}} ({{telefone}}) pediu, no WhatsApp da ENA, para falar com uma pessoa da equipa.", "Última mensagem: {{mensagem}}", "O assistente automático fica em pausa nesta conversa. Responda pela caixa de conversas do GesForma."]'::jsonb,
  '<email>
  <p>{{nome_contacto}} ({{telefone}}) pediu, no WhatsApp da ENA, para falar com uma pessoa da equipa.</p>
  <p>Última mensagem: {{mensagem}}</p>
  <p>O assistente automático fica em pausa nesta conversa. Responda pela caixa de conversas do GesForma.</p>
  <cta ambito="contacto" href="{{link}}">Abrir a conversa</cta>
</email>
', 'Abrir a conversa', '{{link}}', 'contacto'
  FROM (VALUES ('gold'), ('fin')) AS a(area)
ON CONFLICT (tipo, area) DO NOTHING;
