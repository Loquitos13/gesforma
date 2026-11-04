-- Avisos internos por equipa: vão para os utilizadores da equipa certa (nunca para a administração), não para o email da
-- entidade ou do local. Cada regra de aviso interno escolhe a quem vai («Enviar para»):
--   gold          → comerciais e coordenação pedagógica Gold (perfis comercial e secretaria);
--   fin           → coordenação pedagógica Financiada (perfil financiada);
--   contabilidade → perfil contabilidade.
ALTER TABLE email_rules ADD COLUMN IF NOT EXISTS destinatarios text[];
ALTER TABLE email_rules DROP CONSTRAINT IF EXISTS email_rules_destinatarios_check;
ALTER TABLE email_rules ADD CONSTRAINT email_rules_destinatarios_check
  CHECK (destinatarios IS NULL OR destinatarios <@ ARRAY['gold', 'fin', 'contabilidade']::text[]);

-- Documentos recebidos: só os documentos (o comprovativo passa a ter o seu aviso, abaixo).
UPDATE email_rules SET destinatarios = ARRAY[CASE WHEN area = 'fin' THEN 'fin' ELSE 'gold' END]
 WHERE trigger_key = 'equipa.documentos_recebidos' AND destinatarios IS NULL;
UPDATE email_rules SET gatilho_label = 'Documentos recebidos (aviso à equipa)'
 WHERE trigger_key = 'equipa.documentos_recebidos' AND gatilho_label = 'Documentos ou comprovativo recebidos (aviso à equipa)';

-- Comprovativo de pagamento recebido: aviso próprio (Gold: comerciais, coordenação e contabilidade).
INSERT INTO email_templates (tipo, area, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito)
SELECT 'aviso_comprovativo_recebido', a.area, 'Comprovativo de pagamento recebido (aviso à equipa)',
  'Comprovativo recebido · {{nome_formando}}',
  '["{{nome_formando}} enviou o comprovativo de pagamento de {{curso}}.", "Abra a ficha da pré-inscrição para o validar."]'::jsonb,
  '<email>
  <p>{{nome_formando}} enviou o comprovativo de pagamento de {{curso}}.</p>
  <p>Abra a ficha da pré-inscrição para o validar.</p>
  <cta ambito="contacto" href="{{link}}">Abrir a ficha</cta>
</email>
', 'Abrir a ficha', '{{link}}', 'contacto'
  FROM (VALUES ('gold'), ('fin')) AS a(area)
ON CONFLICT (tipo, area) DO NOTHING;

INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, curso, ativo, dias, area, destinatarios)
SELECT 'Aviso à equipa: comprovativo recebido', 'equipa.comprovativo_recebido', 'Comprovativo de pagamento recebido (aviso à equipa)',
       'aviso_comprovativo_recebido', 0, NULL, true, NULL, a.area, ARRAY[a.area, 'contabilidade']
  FROM (VALUES ('gold'), ('fin')) AS a(area)
 WHERE NOT EXISTS (SELECT 1 FROM email_rules r WHERE r.trigger_key = 'equipa.comprovativo_recebido' AND r.area = a.area);
