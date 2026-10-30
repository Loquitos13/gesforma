-- As áreas antigas da Gold passam para as 7 áreas do site (src/partilhado/areasFormacao.ts, ALIASES_AREAS): os cursos
-- mudam de área (coluna e ficha), «Saúde e bem estar» passa a escrever-se como no site e as outras antigas ficam
-- inativas (deixam de aparecer na escolha da ficha do curso).
UPDATE cursos_gold c SET categoria = m.nova
  FROM (VALUES ('saúde e bem estar', 'Saúde e Bem Estar'), ('desenvolvimento pessoal', 'Gestão de Pessoas e Desenvolvimento'),
               ('boas práticas profissionais', 'Gestão de Pessoas e Desenvolvimento'), ('boas práticas para a vida', 'Saúde e Bem Estar'),
               ('boas práticas pedagógicas', 'CCP e Gestão da Formação')) AS m(antiga, nova)
 WHERE lower(trim(c.categoria)) = m.antiga;
UPDATE curso_fichas f SET payload = jsonb_set(f.payload, '{categoria}', to_jsonb(m.nova))
  FROM (VALUES ('saúde e bem estar', 'Saúde e Bem Estar'), ('desenvolvimento pessoal', 'Gestão de Pessoas e Desenvolvimento'),
               ('boas práticas profissionais', 'Gestão de Pessoas e Desenvolvimento'), ('boas práticas para a vida', 'Saúde e Bem Estar'),
               ('boas práticas pedagógicas', 'CCP e Gestão da Formação')) AS m(antiga, nova)
 WHERE f.regime = 'gold' AND lower(trim(f.payload->>'categoria')) = m.antiga;
UPDATE catalog_items SET payload = jsonb_set(payload, '{nome}', '"Saúde e Bem Estar"')
 WHERE kind = 'areas' AND regime = 'gold' AND lower(trim(payload->>'nome')) = 'saúde e bem estar';
UPDATE catalog_items SET payload = payload || '{"estado": "Inativo", "status": "Inativo"}'::jsonb
 WHERE kind = 'areas' AND regime = 'gold'
   AND lower(trim(payload->>'nome')) IN ('desenvolvimento pessoal', 'boas práticas profissionais', 'boas práticas para a vida', 'boas práticas pedagógicas');
