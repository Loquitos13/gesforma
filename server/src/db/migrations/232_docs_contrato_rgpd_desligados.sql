-- O «Contrato de formação» e o regulamento / declaração RGPD eram para teste: ficam desligados em todos os cursos
-- (Gold: contrato e regulamento; Financiada: contrato e declaração RGPD). Voltam a ligar-se na ficha do curso › Documentos.
UPDATE cursos_gold
   SET docs_preinscricao = jsonb_set(
         CASE WHEN jsonb_typeof(docs_preinscricao) = 'object' THEN docs_preinscricao ELSE '{}'::jsonb END,
         '{ocultos}',
         (SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb) FROM (
            SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(docs_preinscricao -> 'ocultos') = 'array' THEN docs_preinscricao -> 'ocultos' ELSE '[]'::jsonb END) AS v
            UNION SELECT 'contrato' UNION SELECT 'regulamento') o));
UPDATE cursos_fin
   SET docs_preinscricao = jsonb_set(
         CASE WHEN jsonb_typeof(docs_preinscricao) = 'object' THEN docs_preinscricao ELSE '{}'::jsonb END,
         '{ocultos}',
         (SELECT COALESCE(jsonb_agg(DISTINCT v), '[]'::jsonb) FROM (
            SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(docs_preinscricao -> 'ocultos') = 'array' THEN docs_preinscricao -> 'ocultos' ELSE '[]'::jsonb END) AS v
            UNION SELECT 'contrato' UNION SELECT 'rgpd') o));
