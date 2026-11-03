-- Gatilhos dos documentos da pré-inscrição (ficha do curso › Documentos): a nacionalidade passa a ser pedida no
-- formulário Gold (com a escolaridade, o local e o horário decide que documentos se pedem).
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS nacionalidade text NOT NULL DEFAULT '';

-- CCP: o comprovativo de 5 anos de experiência passa a gatilho do curso («só se a escolaridade for 12.º ano»),
-- em vez da regra fixa no código. Volta a estar pedido (sai dos escondidos) e só aparece a quem tem o 12.º ano.
UPDATE cursos_gold
   SET docs_preinscricao = jsonb_set(
         jsonb_set(COALESCE(docs_preinscricao, '{}'::jsonb), '{condicoes}',
           COALESCE(docs_preinscricao->'condicoes', '{}'::jsonb) || '{"exp": {"escolaridade": ["12.º ano"]}}'::jsonb),
         '{ocultos}',
         COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements(COALESCE(docs_preinscricao->'ocultos', '[]'::jsonb)) x WHERE x <> '"exp"'::jsonb), '[]'::jsonb))
 WHERE (nome ~* '\mccp\M' OR nome ~* 'forma[cç][aã]o (pedag[oó]gica inicial )?de formadores')
   AND NOT (COALESCE(docs_preinscricao->'condicoes', '{}'::jsonb) ? 'exp');
