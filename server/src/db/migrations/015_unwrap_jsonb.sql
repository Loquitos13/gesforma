-- O driver postgres.js + JSON.stringify gravava jsonb como string ("[...]").
-- jsonb_array_length() sobre esses scalars derrubava o seed e toda a API.

UPDATE turmas_gold SET cronograma = (cronograma #>> '{}')::jsonb
 WHERE jsonb_typeof(cronograma) = 'string' AND (cronograma #>> '{}') ~ '^\s*[\[\{]';

UPDATE turmas_fin SET cronograma = (cronograma #>> '{}')::jsonb
 WHERE jsonb_typeof(cronograma) = 'string' AND (cronograma #>> '{}') ~ '^\s*[\[\{]';

UPDATE formadores SET regimes = (regimes #>> '{}')::jsonb
 WHERE jsonb_typeof(regimes) = 'string' AND (regimes #>> '{}') ~ '^\s*[\[\{]';

UPDATE formandos_fin SET docs = (docs #>> '{}')::jsonb
 WHERE jsonb_typeof(docs) = 'string' AND (docs #>> '{}') ~ '^\s*[\[\{]';

UPDATE email_templates SET body_lines = (body_lines #>> '{}')::jsonb
 WHERE jsonb_typeof(body_lines) = 'string' AND (body_lines #>> '{}') ~ '^\s*[\[\{]';

UPDATE catalog_items SET payload = (payload #>> '{}')::jsonb
 WHERE jsonb_typeof(payload) = 'string' AND (payload #>> '{}') ~ '^\s*[\[\{]';

UPDATE audit_log SET meta = (meta #>> '{}')::jsonb
 WHERE jsonb_typeof(meta) = 'string' AND (meta #>> '{}') ~ '^\s*[\[\{]';

UPDATE app_settings SET values = (values #>> '{}')::jsonb
 WHERE jsonb_typeof(values) = 'string' AND (values #>> '{}') ~ '^\s*[\[\{]';

UPDATE automation_events SET payload = (payload #>> '{}')::jsonb
 WHERE jsonb_typeof(payload) = 'string' AND (payload #>> '{}') ~ '^\s*[\[\{]';

UPDATE email_jobs SET payload = (payload #>> '{}')::jsonb
 WHERE jsonb_typeof(payload) = 'string' AND (payload #>> '{}') ~ '^\s*[\[\{]';

UPDATE curso_dtp_modelos SET excluidos = (excluidos #>> '{}')::jsonb
 WHERE jsonb_typeof(excluidos) = 'string' AND (excluidos #>> '{}') ~ '^\s*[\[\{]';

UPDATE curso_dtp_modelos SET extra = (extra #>> '{}')::jsonb
 WHERE jsonb_typeof(extra) = 'string' AND (extra #>> '{}') ~ '^\s*[\[\{]';

UPDATE curso_fichas SET payload = (payload #>> '{}')::jsonb
 WHERE jsonb_typeof(payload) = 'string' AND (payload #>> '{}') ~ '^\s*[\[\{]';

UPDATE curso_fichas SET criterios = (criterios #>> '{}')::jsonb
 WHERE jsonb_typeof(criterios) = 'string' AND (criterios #>> '{}') ~ '^\s*[\[\{]';

UPDATE inquerito_respostas SET respostas = (respostas #>> '{}')::jsonb
 WHERE jsonb_typeof(respostas) = 'string' AND (respostas #>> '{}') ~ '^\s*[\[\{]';

UPDATE oauth_accounts SET meta = (meta #>> '{}')::jsonb
 WHERE jsonb_typeof(meta) = 'string' AND (meta #>> '{}') ~ '^\s*[\[\{]';

UPDATE turma_documentos SET payload = (payload #>> '{}')::jsonb
 WHERE jsonb_typeof(payload) = 'string' AND (payload #>> '{}') ~ '^\s*[\[\{]';

UPDATE turma_sessoes SET plano = (plano #>> '{}')::jsonb
 WHERE jsonb_typeof(plano) = 'string' AND (plano #>> '{}') ~ '^\s*[\[\{]';

UPDATE turma_sessoes SET sumario = (sumario #>> '{}')::jsonb
 WHERE jsonb_typeof(sumario) = 'string' AND (sumario #>> '{}') ~ '^\s*[\[\{]';

UPDATE turma_sessoes SET presencas = (presencas #>> '{}')::jsonb
 WHERE jsonb_typeof(presencas) = 'string' AND (presencas #>> '{}') ~ '^\s*[\[\{]';
