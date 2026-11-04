-- Turma cheia: a pessoa pode, na ligação pessoal, preferir aguardar pela próxima turma no mesmo horário.
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS aguarda_turma_em timestamptz;
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS aguarda_turma_horario text;

-- O email de turma cheia passa a falar das vagas todas preenchidas, de outros horários e de aguardar pela próxima turma.
UPDATE email_templates
   SET body_xml = replace(replace(replace(body_xml,
         'já não tem vaga.', 'já tem todas as vagas preenchidas.'),
         'Estas são as próximas turmas do mesmo curso com vaga:', 'Pode escolher outra turma do mesmo curso (noutro horário ou com outra data):'),
         'A ligação pessoal continua aberta para escolher outro cronograma.',
         'Na sua ligação pessoal pode escolher uma destas turmas ou, se preferir, aguardar pela próxima turma no mesmo horário: avisamos assim que abrir.'),
       body_lines = replace(replace(replace(body_lines::text,
         'já não tem vaga.', 'já tem todas as vagas preenchidas.'),
         'Estas são as próximas turmas do mesmo curso com vaga:', 'Pode escolher outra turma do mesmo curso (noutro horário ou com outra data):'),
         'A ligação pessoal continua aberta para escolher outro cronograma.',
         'Na sua ligação pessoal pode escolher uma destas turmas ou, se preferir, aguardar pela próxima turma no mesmo horário: avisamos assim que abrir.')::jsonb,
       cta = CASE WHEN cta = 'Escolher outro cronograma' THEN 'Escolher turma ou aguardar' ELSE cta END,
       updated_at = now()
 WHERE tipo = 'turma_cheia';
UPDATE email_templates SET body_xml = replace(body_xml, '>Escolher outro cronograma</cta>', '>Escolher turma ou aguardar</cta>')
 WHERE tipo = 'turma_cheia';
