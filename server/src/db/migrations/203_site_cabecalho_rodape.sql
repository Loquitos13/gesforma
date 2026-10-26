-- Cabeçalho e rodapé do site numa página própria do editor («Cabeçalho e rodapé»), partilhada por todas as páginas
-- (até aqui viviam dentro da página inicial). Começa com os que a página inicial tem agora, rascunho e publicado.
ALTER TABLE site_paginas DROP CONSTRAINT IF EXISTS site_paginas_pagina_check;
ALTER TABLE site_paginas ADD CONSTRAINT site_paginas_pagina_check
  CHECK (pagina IN ('inicio', 'moldura', 'catalogo', 'curso', 'noticias', 'noticia', 'empresas', 'servico', 'area'));

INSERT INTO site_paginas (pagina, rascunho, publicado, publicado_em, atualizado_em, atualizado_por)
SELECT 'moldura',
       CASE WHEN rascunho IS NULL THEN NULL ELSE jsonb_build_object('root', jsonb_build_object('props', '{}'::jsonb), 'content',
         (SELECT coalesce(jsonb_agg(b), '[]'::jsonb) FROM jsonb_array_elements(rascunho->'content') b WHERE b->>'type' IN ('Cabecalho', 'Rodape'))) END,
       CASE WHEN publicado IS NULL THEN NULL ELSE jsonb_build_object('root', jsonb_build_object('props', '{}'::jsonb), 'content',
         (SELECT coalesce(jsonb_agg(b), '[]'::jsonb) FROM jsonb_array_elements(publicado->'content') b WHERE b->>'type' IN ('Cabecalho', 'Rodape'))) END,
       publicado_em, atualizado_em, atualizado_por
  FROM site_paginas
 WHERE pagina = 'inicio'
ON CONFLICT (pagina) DO NOTHING;
