-- O email do comprovativo à contabilidade passa a dizer a ação de formação (local, horário, início e turma): com o
-- mesmo valor em vários horários, só assim se liga o pagamento à turma certa.
UPDATE email_templates
   SET body_xml = replace(body_xml, 'Curso: {{curso}}<br>Valor:', 'Curso: {{curso}}<br>Ação de formação: {{acao_formacao}}<br>Valor:'),
       body_lines = replace(body_lines::text, 'Curso: {{curso}}<br>Valor:', 'Curso: {{curso}}<br>Ação de formação: {{acao_formacao}}<br>Valor:')::jsonb,
       updated_at = now()
 WHERE tipo = 'comprovativo_contabilidade' AND body_xml NOT LIKE '%{{acao_formacao}}%';
