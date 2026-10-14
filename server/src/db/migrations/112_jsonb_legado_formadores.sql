-- Colunas jsonb criadas depois da 015 também ficaram gravadas como texto ("[...]") ou null JSON.
-- jsonb_array_elements_text() sobre esses scalars dava 500 na lista de formadores da Financiada.

UPDATE turmas_gold SET formadores = (formadores #>> '{}')::jsonb
 WHERE jsonb_typeof(formadores) = 'string' AND (formadores #>> '{}') ~ '^\s*\[';
UPDATE turmas_fin SET formadores = (formadores #>> '{}')::jsonb
 WHERE jsonb_typeof(formadores) = 'string' AND (formadores #>> '{}') ~ '^\s*\[';
UPDATE turmas_gold SET formadores = '[]'::jsonb WHERE jsonb_typeof(formadores) IS DISTINCT FROM 'array';
UPDATE turmas_fin SET formadores = '[]'::jsonb WHERE jsonb_typeof(formadores) IS DISTINCT FROM 'array';

UPDATE turmas_gold SET valores_hora_formador = (valores_hora_formador #>> '{}')::jsonb
 WHERE jsonb_typeof(valores_hora_formador) = 'string' AND (valores_hora_formador #>> '{}') ~ '^\s*\{';
UPDATE turmas_fin SET valores_hora_formador = (valores_hora_formador #>> '{}')::jsonb
 WHERE jsonb_typeof(valores_hora_formador) = 'string' AND (valores_hora_formador #>> '{}') ~ '^\s*\{';
UPDATE turmas_gold SET valores_hora_formador = '{}'::jsonb WHERE jsonb_typeof(valores_hora_formador) IS DISTINCT FROM 'object';
UPDATE turmas_fin SET valores_hora_formador = '{}'::jsonb WHERE jsonb_typeof(valores_hora_formador) IS DISTINCT FROM 'object';

UPDATE formadores SET regimes = (regimes #>> '{}')::jsonb
 WHERE jsonb_typeof(regimes) = 'string' AND (regimes #>> '{}') ~ '^\s*\[';
UPDATE formadores SET disponibilidade = (disponibilidade #>> '{}')::jsonb
 WHERE jsonb_typeof(disponibilidade) = 'string' AND (disponibilidade #>> '{}') ~ '^\s*\[';
UPDATE formadores SET disponibilidade = '[]'::jsonb WHERE jsonb_typeof(disponibilidade) IS DISTINCT FROM 'array';
