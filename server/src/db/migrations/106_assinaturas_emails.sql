-- Modelos de email da assinatura de contratos (editáveis em Sistema › Emails automáticos › Modelos).
-- O botão leva sempre à ligação pessoal de assinatura; o código vai sempre por email.
INSERT INTO email_templates (tipo, nome, assunto, body_lines, cta, cta_href, cta_ambito) VALUES
('assinatura_convite', 'Assinatura · convite', 'Contrato para assinar: {{documento}}',
 '["A {{entidade}} enviou-lhe o documento <strong>{{documento}}</strong> para assinar.", "Abra a ligação, leia o documento e assine com o rato, o dedo ou escrevendo o seu nome. Antes de assinar recebe um código de confirmação neste email.", "A ligação é pessoal e válida até {{validade}}."]'::jsonb,
 'Ler e assinar', '', 'contacto'),
('assinatura_codigo', 'Assinatura · código de confirmação', 'Código para assinar {{documento}}: {{codigo}}',
 '["O seu código para assinar <strong>{{documento}}</strong> é:", "<strong>{{codigo}}</strong>", "É válido durante {{minutos}} minutos. Se não pediu este código, ignore este email: sem o código ninguém assina em seu nome."]'::jsonb,
 '', '', 'contacto'),
('assinatura_concluida', 'Assinatura · documento assinado', 'Documento assinado: {{documento}}',
 '["Obrigado. O documento <strong>{{documento}}</strong> ficou assinado a {{data}}.", "Pode descarregar a cópia assinada na mesma ligação. O código de verificação é {{verificacao}}."]'::jsonb,
 'Descarregar cópia assinada', '', 'contacto'),
('assinatura_equipa', 'Assinatura · aviso à equipa', '{{signatario}} assinou {{documento}}',
 '["{{signatario}} assinou o documento <strong>{{documento}}</strong> a {{data}}.", "O PDF assinado foi guardado e o registo de provas está no contrato."]'::jsonb,
 'Abrir no GesForma', '', 'contacto')
ON CONFLICT (tipo) DO NOTHING;
