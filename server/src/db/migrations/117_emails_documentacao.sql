-- Emails da documentação da pré-inscrição com o texto da ENA (versão para qualquer curso).
-- Confirmação (welcome), lembrete e último lembrete; os dois lembretes passam a modelos editáveis.
-- {{documentos_itens}}, {{documentos_em_falta_itens}} e {{telefones_itens}} saem como lista, um item por linha.

ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS ultimo_lembrete_em timestamptz;

-- Telefones por zona (Configurações › Entidade), só se ainda não estiverem preenchidos.
INSERT INTO app_settings (id, values) VALUES ('entidade', '{}'::jsonb) ON CONFLICT (id) DO NOTHING;
UPDATE app_settings
   SET values = values || jsonb_build_object('telefonesZona',
     E'223781100 se pretende realizar o curso no Porto/Gaia\n223781101 se pretende realizar o curso em Braga ou Aveiro\n223781102 se pretende realizar o curso em Lisboa')
 WHERE id = 'entidade' AND NOT (values ? 'telefonesZona');

-- Confirmação: só substitui o texto de origem (não apaga o que a equipa já reescreveu).
UPDATE email_templates
   SET assunto = 'Inscrição no curso {{curso}} | ENA – Documentação necessária',
       body_lines = '["Confirmamos a sua pré-inscrição no curso {{curso}} da ENA.", "Para darmos seguimento ao seu processo de inscrição e validação, solicitamos o envio dos seguintes documentos:<br>{{documentos_itens}}", "Ficamos à disposição para qualquer esclarecimento adicional. Ligue para:<br>{{telefones_itens}}", "Por favor, submeta a sua documentação através do botão abaixo:"]'::jsonb,
       body_xml = E'<email>\n  <p>Confirmamos a sua pré-inscrição no curso {{curso}} da ENA.</p>\n  <p>Para darmos seguimento ao seu processo de inscrição e validação, solicitamos o envio dos seguintes documentos:<br>{{documentos_itens}}</p>\n  <p>Ficamos à disposição para qualquer esclarecimento adicional. Ligue para:<br>{{telefones_itens}}</p>\n  <p>Por favor, submeta a sua documentação através do botão abaixo:</p>\n  <cta ambito="documentos" href="{{documentos_url}}">Submeter Documentos</cta>\n</email>\n',
       cta = 'Submeter Documentos', cta_href = '{{documentos_url}}', cta_ambito = 'documentos', updated_at = now()
 WHERE tipo = 'welcome'
   AND (COALESCE(body_xml, '') ILIKE '%Confirmámos o seu interesse%' OR body_lines::text ILIKE '%Confirmámos o seu interesse%');

INSERT INTO email_templates (tipo, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito) VALUES
('lembrete_docs', 'Lembrete · documentação pendente',
 'Lembrete: Documentação pendente para a sua inscrição no curso {{curso}} | ENA',
 '["Esperamos que se encontre bem.", "Notámos que a sua pré-inscrição no curso {{curso}} ainda se encontra pendente da receção/validação de alguns documentos necessários para a conclusão do processo:<br>{{documentos_em_falta_itens}}", "Caso tenha alguma dúvida ou precise de apoio no carregamento dos ficheiros, estamos inteiramente ao seu dispor. Pode contactar-nos através dos seguintes números:<br>{{telefones_itens}}", "Para podermos validar a sua inscrição e garantir a sua vaga na turma pretendida, solicitamos que conclua o envio da documentação em falta através do botão abaixo:"]'::jsonb,
 E'<email>\n  <p>Esperamos que se encontre bem.</p>\n  <p>Notámos que a sua pré-inscrição no curso {{curso}} ainda se encontra pendente da receção/validação de alguns documentos necessários para a conclusão do processo:<br>{{documentos_em_falta_itens}}</p>\n  <p>Caso tenha alguma dúvida ou precise de apoio no carregamento dos ficheiros, estamos inteiramente ao seu dispor. Pode contactar-nos através dos seguintes números:<br>{{telefones_itens}}</p>\n  <p>Para podermos validar a sua inscrição e garantir a sua vaga na turma pretendida, solicitamos que conclua o envio da documentação em falta através do botão abaixo:</p>\n  <cta ambito="documentos" href="{{documentos_url}}">Submeter Documentação Pendente</cta>\n</email>\n',
 'Submeter Documentação Pendente', '{{documentos_url}}', 'documentos'),
('lembrete_docs_final', 'Último lembrete · documentação',
 'Último Lembrete: Regularização da documentação de inscrição | ENA',
 '["Entramos em contacto novamente no seguimento do seu pedido de pré-inscrição no curso {{curso}} da ENA.", "Verificámos que, até ao momento, ainda não recebemos a documentação necessária para validar e formalizar a sua inscrição, pelo que a sua vaga permanece pendente de confirmação:<br>{{documentos_em_falta_itens}}", "Caso tenha qualquer dúvida no processo, agradecemos que entre em contacto connosco através de um dos nossos contactos telefónicos:<br>{{telefones_itens}}", "Para evitar o cancelamento do processo de pré-inscrição e garantir a sua vaga na próxima turma, solicitamos que submeta os seus documentos o mais brevemente possível através do botão abaixo:"]'::jsonb,
 E'<email>\n  <p>Entramos em contacto novamente no seguimento do seu pedido de pré-inscrição no curso {{curso}} da ENA.</p>\n  <p>Verificámos que, até ao momento, ainda não recebemos a documentação necessária para validar e formalizar a sua inscrição, pelo que a sua vaga permanece pendente de confirmação:<br>{{documentos_em_falta_itens}}</p>\n  <p>Caso tenha qualquer dúvida no processo, agradecemos que entre em contacto connosco através de um dos nossos contactos telefónicos:<br>{{telefones_itens}}</p>\n  <p>Para evitar o cancelamento do processo de pré-inscrição e garantir a sua vaga na próxima turma, solicitamos que submeta os seus documentos o mais brevemente possível através do botão abaixo:</p>\n  <cta ambito="documentos" href="{{documentos_url}}">Finalizar Submissão de Documentos</cta>\n</email>\n',
 'Finalizar Submissão de Documentos', '{{documentos_url}}', 'documentos')
ON CONFLICT (tipo) DO NOTHING;
