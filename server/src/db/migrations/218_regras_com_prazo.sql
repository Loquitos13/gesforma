-- Regras com prazo: dias antes (ou depois) de uma data, configuráveis em cada regra (email_rules.dias).
ALTER TABLE email_rules ADD COLUMN IF NOT EXISTS dias integer CHECK (dias IS NULL OR (dias >= 0 AND dias <= 365));

-- Modelos das regras novas (editáveis em Sistema › Emails › Modelos).
INSERT INTO email_templates (tipo, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito) VALUES
('lembrete_matricula', 'Lembrete · data limite de matrícula', 'Matrícula em {{curso}} até {{data_limite}}', '["A data limite para concluir a matrícula em {{curso}} ({{turma}}) é {{data_limite}}.", "Se ainda faltam documentos ou o pagamento, trate disso até essa data para garantir o lugar na turma.", "Use o botão para abrir a sua página pessoal."]'::jsonb, '<email>
  <p>A data limite para concluir a matrícula em {{curso}} ({{turma}}) é {{data_limite}}.</p>
  <p>Se ainda faltam documentos ou o pagamento, trate disso até essa data para garantir o lugar na turma.</p>
  <p>Use o botão para abrir a sua página pessoal.</p>
  <cta ambito="contacto" href="{{link}}">Concluir a matrícula</cta>
</email>
', 'Concluir a matrícula', '{{link}}', 'contacto'),
('lembrete_documentos_prazo', 'Lembrete · documentos antes do prazo', 'Faltam documentos para {{curso}}', '["Para concluir a inscrição em {{curso}} ({{turma}}) até {{data_limite}}, ainda faltam estes documentos:<br>{{documentos_em_falta_itens}}", "Use o botão para os enviar na sua página pessoal."]'::jsonb, '<email>
  <p>Para concluir a inscrição em {{curso}} ({{turma}}) até {{data_limite}}, ainda faltam estes documentos:<br>{{documentos_em_falta_itens}}</p>
  <p>Use o botão para os enviar na sua página pessoal.</p>
  <cta ambito="contacto" href="{{link}}">Enviar documentos</cta>
</email>
', 'Enviar documentos', '{{link}}', 'contacto'),
('lembrete_pagamento', 'Lembrete · pagamento por fazer', 'Pagamento da inscrição em {{curso}}', '["Ainda não recebemos o comprovativo do pagamento de € {{valor}} da inscrição em {{curso}}.", "Se já fez a transferência, anexe o comprovativo na sua página de pagamento. Se ainda não fez, encontra lá os dados para a transferência.", "Assim que o pagamento for confirmado, recebe por email o acesso à área do formando."]'::jsonb, '<email>
  <p>Ainda não recebemos o comprovativo do pagamento de € {{valor}} da inscrição em {{curso}}.</p>
  <p>Se já fez a transferência, anexe o comprovativo na sua página de pagamento. Se ainda não fez, encontra lá os dados para a transferência.</p>
  <p>Assim que o pagamento for confirmado, recebe por email o acesso à área do formando.</p>
  <cta ambito="contacto" href="{{link}}">Pagar e anexar o comprovativo</cta>
</email>
', 'Pagar e anexar o comprovativo', '{{link}}', 'contacto'),
('integracao_turma', 'Integração na turma · antes do início', 'Bem-vindo à turma {{turma}} · {{curso}}', '["A sua turma de {{curso}} começa a {{data_inicio}}.", "Local: {{local}}<br>Horário: {{horario}}", "Na área do formando encontra o cronograma, os documentos e os contactos da equipa. Qualquer dúvida, responda a este email."]'::jsonb, '<email>
  <p>A sua turma de {{curso}} começa a {{data_inicio}}.</p>
  <p>Local: {{local}}<br>Horário: {{horario}}</p>
  <p>Na área do formando encontra o cronograma, os documentos e os contactos da equipa. Qualquer dúvida, responda a este email.</p>
  <cta ambito="contacto" href="{{link}}">Entrar na área do formando</cta>
</email>
', 'Entrar na área do formando', '{{link}}', 'contacto'),
('aviso_documentos_recebidos', 'Documentos ou comprovativo recebidos (aviso à equipa)', '{{documento}} recebido · {{nome_formando}}', '["{{nome_formando}} enviou {{documento}} para {{curso}}.", "Abra a ficha da pré-inscrição para o validar."]'::jsonb, '<email>
  <p>{{nome_formando}} enviou {{documento}} para {{curso}}.</p>
  <p>Abra a ficha da pré-inscrição para o validar.</p>
  <cta ambito="contacto" href="{{link}}">Abrir a ficha</cta>
</email>
', 'Abrir a ficha', '{{link}}', 'contacto'),
('formador_atribuido', 'Formador atribuído a uma turma', 'Nova turma atribuída · {{turma}}', '["Foi atribuído à turma {{turma}} de {{curso}}.", "Início: {{data_inicio}}<br>Local: {{local}}<br>Horário: {{horario}}", "Na sua área do GesForma encontra o cronograma, as sessões e os planos."]'::jsonb, '<email>
  <p>Foi atribuído à turma {{turma}} de {{curso}}.</p>
  <p>Início: {{data_inicio}}<br>Local: {{local}}<br>Horário: {{horario}}</p>
  <p>Na sua área do GesForma encontra o cronograma, as sessões e os planos.</p>
  <cta ambito="contacto" href="{{link}}">Abrir as minhas turmas</cta>
</email>
', 'Abrir as minhas turmas', '{{link}}', 'contacto')
ON CONFLICT (tipo) DO NOTHING;

INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, curso, ativo, dias)
SELECT 'Lembrete da data limite de matrícula', 'matricula.antes_limite', 'Antes da data limite de matrícula', 'lembrete_matricula', 0, NULL, true, 2
 WHERE NOT EXISTS (SELECT 1 FROM email_rules WHERE trigger_key = 'matricula.antes_limite');
INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, curso, ativo, dias)
SELECT 'Lembrete dos documentos antes do prazo', 'documentos.antes_prazo', 'Antes do prazo dos documentos', 'lembrete_documentos_prazo', 0, NULL, true, 3
 WHERE NOT EXISTS (SELECT 1 FROM email_rules WHERE trigger_key = 'documentos.antes_prazo');
INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, curso, ativo, dias)
SELECT 'Lembrete de pagamento', 'pagamento.sem_comprovativo', 'Pagamento pedido sem comprovativo', 'lembrete_pagamento', 0, NULL, true, 3
 WHERE NOT EXISTS (SELECT 1 FROM email_rules WHERE trigger_key = 'pagamento.sem_comprovativo');
INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, curso, ativo, dias)
SELECT 'Integração na turma', 'turma.integracao', 'Antes do início da turma (integração)', 'integracao_turma', 0, NULL, true, 3
 WHERE NOT EXISTS (SELECT 1 FROM email_rules WHERE trigger_key = 'turma.integracao');
INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, curso, ativo, dias)
SELECT 'Aviso à equipa: documentos recebidos', 'equipa.documentos_recebidos', 'Documentos ou comprovativo recebidos (aviso à equipa)', 'aviso_documentos_recebidos', 0, NULL, true, NULL
 WHERE NOT EXISTS (SELECT 1 FROM email_rules WHERE trigger_key = 'equipa.documentos_recebidos');
INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, curso, ativo, dias)
SELECT 'Aviso ao formador: turma atribuída', 'formador.atribuido', 'Formador atribuído a uma turma', 'formador_atribuido', 0, NULL, true, NULL
 WHERE NOT EXISTS (SELECT 1 FROM email_rules WHERE trigger_key = 'formador.atribuido');
