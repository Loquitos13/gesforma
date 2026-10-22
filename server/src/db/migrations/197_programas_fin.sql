-- Programas da Financiada (Edição de cursos › Programas): cada programa tem a sua prioridade e tipologias, e cada
-- turma escolhe o seu. Até aqui havia uma só candidatura em Configurações › Financiada: passa a ser o primeiro programa.
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS programa text NOT NULL DEFAULT '';

INSERT INTO catalog_items (id, kind, regime, payload)
SELECT nextval('ops_id_seq'), 'programas', 'fin',
       jsonb_build_object(
         'nome', 'PESSOAS 2030',
         'status', 'Ativo',
         'programa', 'PESSOAS 2030 (Programa Temático Demografia, Qualificações e Inclusão)',
         'prioridade', '4C. Mais e melhor (re) qualificação de adultos para crescer',
         'tipologiaAcao', 'ESO4.7-01 – (Re) Qualificação de adultos',
         'tipologiaIntervencao', 'ESO4.7-01-01 – Formação de ativos para a empregabilidade',
         'tipologiaOperacao', '4030 - Formações Modulares Certificadas',
         'tipologia', '1.08. Formação Modular para Empregados e Desempregados'
       ) || COALESCE((SELECT values FROM app_settings WHERE id = 'candidatura_fin'), '{}'::jsonb)
 WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE kind = 'programas');

UPDATE turmas_fin SET programa = 'PESSOAS 2030'
 WHERE programa = '' AND EXISTS (SELECT 1 FROM catalog_items WHERE kind = 'programas' AND payload->>'nome' = 'PESSOAS 2030');
