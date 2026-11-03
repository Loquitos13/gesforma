-- Pedido de contacto do site: só a confirmação de que chegou (sem a ligação dos documentos nem o texto do pedido).
INSERT INTO email_templates (tipo, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito) VALUES
('pedido_contacto', 'Pedido de contacto recebido (site)', 'Recebemos o seu pedido de contacto', '["Recebemos o seu pedido de contacto{{sobre_curso}}.", "A equipa da ENA vai contactá-lo em breve, por telefone ou WhatsApp."]'::jsonb, '<email>
  <p>Recebemos o seu pedido de contacto{{sobre_curso}}.</p>
  <p>A equipa da ENA vai contactá-lo em breve, por telefone ou WhatsApp.</p>
</email>
', '', '', 'contacto')
ON CONFLICT (tipo) DO NOTHING;
