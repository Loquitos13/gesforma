-- Comprovativo de pagamento recebido: aviso à contabilidade (email em Configurações › Entidade), com o ficheiro em anexo.
INSERT INTO email_templates (tipo, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito) VALUES
('comprovativo_contabilidade', 'Comprovativo de pagamento recebido (aviso à contabilidade)', 'Comprovativo de pagamento · {{nome_formando}} · {{curso}}', '["Chegou um comprovativo de pagamento (em anexo).", "Nome: {{nome_formando}}<br>NIF: {{nif}}<br>Telemóvel: {{telemovel}}<br>Email: {{email_formando}}<br>IBAN: {{iban_formando}}", "Curso: {{curso}}<br>Valor: € {{valor}}", "Conta de destino: {{iban}}"]'::jsonb, '<email>
  <p>Chegou um comprovativo de pagamento (em anexo).</p>
  <p>Nome: {{nome_formando}}<br>NIF: {{nif}}<br>Telemóvel: {{telemovel}}<br>Email: {{email_formando}}<br>IBAN: {{iban_formando}}</p>
  <p>Curso: {{curso}}<br>Valor: € {{valor}}</p>
  <p>Conta de destino: {{iban}}</p>
</email>
', '', '', 'contacto')
ON CONFLICT (tipo) DO NOTHING;
