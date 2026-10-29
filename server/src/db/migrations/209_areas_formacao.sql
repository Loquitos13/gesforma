-- As áreas de formação do site (src/partilhado/areasFormacao.ts): criam-se na Gold as que ainda não existem, para se
-- escolherem na ficha do curso. As que já existem ficam como estão (reatribuir cursos e desativar as antigas faz-se em
-- Edição de cursos › Áreas temáticas). «Formação Financiada» não entra: os cursos financiados ficam lá sozinhos.
INSERT INTO catalog_items (id, kind, regime, payload)
SELECT nextval('ops_id_seq'), 'areas', 'gold', jsonb_build_object('nome', a.nome, 'estado', 'Ativo', 'cursos', 0)
  FROM (VALUES
    ('CCP e Gestão da Formação'), ('Informática e IA'), ('Saúde e Bem Estar'), ('Gestão de Pessoas e Desenvolvimento'),
    ('Marketing, Business e Comunicação'), ('Seguros e Fundos de Pensões')
  ) AS a(nome)
 WHERE NOT EXISTS (
   SELECT 1 FROM catalog_items c
    WHERE c.kind = 'areas' AND c.regime = 'gold' AND lower(trim(c.payload->>'nome')) = lower(a.nome)
 );
