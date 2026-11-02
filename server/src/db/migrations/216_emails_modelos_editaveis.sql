-- Emails automáticos que tinham o texto fixo no código passam a modelos editáveis (Sistema › Emails › Modelos).
-- O texto de origem é o que já saía; o botão usa {{link}} (o endereço próprio de cada email).
INSERT INTO email_templates (tipo, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito) VALUES
('acesso_formando_pago', 'Acesso à área do formando · pagamento confirmado (Gold)', 'Pagamento confirmado · acesso a {{curso}}', '["O pagamento de {{curso}} está confirmado e a sua inscrição está concluída.", "Já pode entrar na área do formando, onde encontra o curso, a agenda e os documentos.", "Utilizador: {{email}}", "{{palavra_passe}}"]'::jsonb, '<email>
  <p>O pagamento de {{curso}} está confirmado e a sua inscrição está concluída.</p>
  <p>Já pode entrar na área do formando, onde encontra o curso, a agenda e os documentos.</p>
  <p>Utilizador: {{email}}</p>
  <p>{{palavra_passe}}</p>
  <cta ambito="contacto" href="{{link}}">Entrar na área do formando</cta>
</email>
', 'Entrar na área do formando', '{{link}}', 'contacto'),
('acesso_formando', 'Acesso à área do formando · inscrição concluída', 'Inscrição concluída · acesso a {{curso}}', '["A sua inscrição em {{curso}} está concluída.", "Já pode entrar na área do formando, onde encontra o curso, a agenda e os documentos.", "Utilizador: {{email}}", "{{palavra_passe}}"]'::jsonb, '<email>
  <p>A sua inscrição em {{curso}} está concluída.</p>
  <p>Já pode entrar na área do formando, onde encontra o curso, a agenda e os documentos.</p>
  <p>Utilizador: {{email}}</p>
  <p>{{palavra_passe}}</p>
  <cta ambito="contacto" href="{{link}}">Entrar na área do formando</cta>
</email>
', 'Entrar na área do formando', '{{link}}', 'contacto'),
('pedido_pagamento', 'Pedido de pagamento (pré-inscrição)', 'Pagamento da inscrição em {{curso}}', '["A secretaria validou os seus documentos de {{curso}}.", "Para concluir a inscrição, falta o pagamento de € {{valor}} por transferência bancária.", "Clique no botão para abrir a sua página de pagamento: aí encontra os dados para a transferência e o campo para anexar o comprovativo.", "Assim que o pagamento for confirmado, recebe por email o acesso à área do formando."]'::jsonb, '<email>
  <p>A secretaria validou os seus documentos de {{curso}}.</p>
  <p>Para concluir a inscrição, falta o pagamento de € {{valor}} por transferência bancária.</p>
  <p>Clique no botão para abrir a sua página de pagamento: aí encontra os dados para a transferência e o campo para anexar o comprovativo.</p>
  <p>Assim que o pagamento for confirmado, recebe por email o acesso à área do formando.</p>
  <cta ambito="contacto" href="{{link}}">Pagar e anexar o comprovativo</cta>
</email>
', 'Pagar e anexar o comprovativo', '{{link}}', 'contacto'),
('pedido_pagamento_formando', 'Pedido de pagamento (ficha do formando, Gold)', 'Pagamento da inscrição em {{curso}}', '["Para concluir a inscrição em {{curso}}, faça o pagamento de € {{valor}} por transferência bancária.", "IBAN: {{iban}} · Titular: {{titular}}", "Depois responda a este email com o comprovativo da transferência.", "Assim que o pagamento for confirmado pela secretaria, recebe a confirmação por email."]'::jsonb, '<email>
  <p>Para concluir a inscrição em {{curso}}, faça o pagamento de € {{valor}} por transferência bancária.</p>
  <p>IBAN: {{iban}} · Titular: {{titular}}</p>
  <p>Depois responda a este email com o comprovativo da transferência.</p>
  <p>Assim que o pagamento for confirmado pela secretaria, recebe a confirmação por email.</p>
  <cta ambito="contacto" href="{{link}}">Abrir a área do formando</cta>
</email>
', 'Abrir a área do formando', '{{link}}', 'contacto'),
('comprovativo_recusado', 'Comprovativo de pagamento recusado', 'Comprovativo de pagamento · {{curso}}', '["Não conseguimos confirmar o comprovativo de pagamento de {{curso}}.", "Motivo: {{motivo}}", "Pode anexar um novo comprovativo na sua ligação pessoal, no passo «Pagamento»."]'::jsonb, '<email>
  <p>Não conseguimos confirmar o comprovativo de pagamento de {{curso}}.</p>
  <p>Motivo: {{motivo}}</p>
  <p>Pode anexar um novo comprovativo na sua ligação pessoal, no passo «Pagamento».</p>
  <cta ambito="contacto" href="{{link}}">Anexar novo comprovativo</cta>
</email>
', 'Anexar novo comprovativo', '{{link}}', 'contacto'),
('turma_cheia', 'Turma cheia · outras datas', 'Turma cheia · outras datas de {{curso}}', '["A turma de {{curso}} em {{local}} já não tem vaga.", "Estas são as próximas turmas do mesmo curso com vaga:<br>{{turmas_itens}}", "{{sem_turmas}}", "A ligação pessoal continua aberta para escolher outro cronograma."]'::jsonb, '<email>
  <p>A turma de {{curso}} em {{local}} já não tem vaga.</p>
  <p>Estas são as próximas turmas do mesmo curso com vaga:<br>{{turmas_itens}}</p>
  <p>{{sem_turmas}}</p>
  <p>A ligação pessoal continua aberta para escolher outro cronograma.</p>
  <cta ambito="contacto" href="{{link}}">Escolher outro cronograma</cta>
</email>
', 'Escolher outro cronograma', '{{link}}', 'contacto'),
('documentos_em_falta', 'Documentos em falta ao concluir a pré-inscrição', 'Documentos em falta · {{curso}}', '["A pré-inscrição em {{curso}} ficou registada e aguarda validação da secretaria.", "Ainda faltam estes documentos:<br>{{documentos_em_falta_itens}}", "A secretaria recusou estes documentos:<br>{{documentos_recusados_itens}}", "Use o botão para abrir a ligação pessoal no passo de enviar os documentos. A ligação fecha quando a secretaria validar todos."]'::jsonb, '<email>
  <p>A pré-inscrição em {{curso}} ficou registada e aguarda validação da secretaria.</p>
  <p>Ainda faltam estes documentos:<br>{{documentos_em_falta_itens}}</p>
  <p>A secretaria recusou estes documentos:<br>{{documentos_recusados_itens}}</p>
  <p>Use o botão para abrir a ligação pessoal no passo de enviar os documentos. A ligação fecha quando a secretaria validar todos.</p>
  <cta ambito="contacto" href="{{link}}">Enviar documentos</cta>
</email>
', 'Enviar documentos', '{{link}}', 'contacto'),
('lembrete_turma', 'Lembrete · falta escolher a turma', 'Lembrete da pré-inscrição · {{curso}}', '["Lembrete da pré-inscrição em {{curso}}.", "{{situacao}}", "Use o botão para abrir a ligação pessoal no passo que falta concluir."]'::jsonb, '<email>
  <p>Lembrete da pré-inscrição em {{curso}}.</p>
  <p>{{situacao}}</p>
  <p>Use o botão para abrir a ligação pessoal no passo que falta concluir.</p>
  <cta ambito="contacto" href="{{link}}">Escolher turma</cta>
</email>
', 'Escolher turma', '{{link}}', 'contacto'),
('lembrete_docs_fin_inicio', 'Documentos em falta (formando Financiada, 1.º pedido)', 'Documentos em falta · {{curso}}', '["Para concluir a inscrição na formação {{curso}} faltam os seguintes documentos:<br>{{documentos_em_falta_itens}}", "Use o botão para enviar um ficheiro de cada vez na área segura. Se a secretaria tiver recusado algum documento, só poderá reenviar esses."]'::jsonb, '<email>
  <p>Para concluir a inscrição na formação {{curso}} faltam os seguintes documentos:<br>{{documentos_em_falta_itens}}</p>
  <p>Use o botão para enviar um ficheiro de cada vez na área segura. Se a secretaria tiver recusado algum documento, só poderá reenviar esses.</p>
  <cta ambito="contacto" href="{{link}}">Enviar documentos</cta>
</email>
', 'Enviar documentos', '{{link}}', 'contacto'),
('plano_aprovado', 'Plano de sessão aprovado (formador)', 'Plano de sessão aprovado · {{turma}} · sessão {{sessao}}', '["O plano da sessão {{sessao}}{{data_sessao}} da turma {{turma}} ({{curso}}) foi aprovado pela coordenação pedagógica{{revisto_por}}.", "Comentários:<br>{{comentario_itens}}", "Não precisa de fazer mais nada."]'::jsonb, '<email>
  <p>O plano da sessão {{sessao}}{{data_sessao}} da turma {{turma}} ({{curso}}) foi aprovado pela coordenação pedagógica{{revisto_por}}.</p>
  <p>Comentários:<br>{{comentario_itens}}</p>
  <p>Não precisa de fazer mais nada.</p>
  <cta ambito="contacto" href="{{link}}">Ver o plano</cta>
</email>
', 'Ver o plano', '{{link}}', 'contacto'),
('plano_devolvido', 'Plano de sessão devolvido (formador)', 'Plano de sessão devolvido · {{turma}} · sessão {{sessao}}', '["O plano da sessão {{sessao}}{{data_sessao}} da turma {{turma}} ({{curso}}) foi devolvido pela coordenação pedagógica{{revisto_por}}.", "Comentários:<br>{{comentario_itens}}", "Corrija o plano e volte a submetê-lo para aprovação."]'::jsonb, '<email>
  <p>O plano da sessão {{sessao}}{{data_sessao}} da turma {{turma}} ({{curso}}) foi devolvido pela coordenação pedagógica{{revisto_por}}.</p>
  <p>Comentários:<br>{{comentario_itens}}</p>
  <p>Corrija o plano e volte a submetê-lo para aprovação.</p>
  <cta ambito="contacto" href="{{link}}">Corrigir o plano</cta>
</email>
', 'Corrigir o plano', '{{link}}', 'contacto'),
('inquerito_turma', 'Inquérito da turma', 'Inquérito da turma {{turma}}', '["Pedimos a sua resposta ao inquérito da turma {{turma}} ({{curso}}). Público-alvo: {{publico}}.", "{{inqueritos_itens}}"]'::jsonb, '<email>
  <p>Pedimos a sua resposta ao inquérito da turma {{turma}} ({{curso}}). Público-alvo: {{publico}}.</p>
  <p>{{inqueritos_itens}}</p>
  <cta ambito="contacto" href="{{link}}">Responder ao inquérito</cta>
</email>
', 'Responder ao inquérito', '{{link}}', 'contacto'),
('pedido_proposta', 'Novo pedido de proposta no site (aviso interno)', 'Pedido de proposta: {{empresa}}', '["Novo pedido de proposta no site.", "Nome: {{nome_contacto}}<br>Empresa: {{empresa}}<br>Email: {{email_contacto}}<br>Telefone: {{telefone}}<br>Serviço: {{servico}}", "{{mensagem}}", "Ficou registado em CRM › Clientes."]'::jsonb, '<email>
  <p>Novo pedido de proposta no site.</p>
  <p>Nome: {{nome_contacto}}<br>Empresa: {{empresa}}<br>Email: {{email_contacto}}<br>Telefone: {{telefone}}<br>Serviço: {{servico}}</p>
  <p>{{mensagem}}</p>
  <p>Ficou registado em CRM › Clientes.</p>
</email>
', '', '', 'contacto')
ON CONFLICT (tipo) DO NOTHING;
