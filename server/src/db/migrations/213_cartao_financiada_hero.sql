-- Cartão «Formação Financiada» do topo da página inicial (pedido do cliente, 31-10-2026): etiquetas «Financiada» e
-- «Subsídio de 6€ por dia», capa do Pessoas 2030 com fundo branco, logótipos de financiamento ao lado do botão e
-- botão «Cursos». Só muda o cartão que ainda tem a etiqueta antiga «6€ por dia» (rascunho e versão publicada).
UPDATE site_paginas SET
  rascunho = CASE WHEN rascunho IS NULL THEN NULL ELSE replace(replace(rascunho::text,
    '"etiqueta": "6€ por dia"',
    '"etiqueta": "Financiada", "etiqueta2": "Subsídio de 6€ por dia", "botao": "Cursos", "imagemRodape": "/imagens/logos-financiamento.png"'),
    '"imagem": "/api/v1/public/imagens/4Dgm_L7Chyj1WvBvtfTZgCkM"', '"imagem": "/imagens/financiada-capa.jpg"')::jsonb END,
  publicado = CASE WHEN publicado IS NULL THEN NULL ELSE replace(replace(publicado::text,
    '"etiqueta": "6€ por dia"',
    '"etiqueta": "Financiada", "etiqueta2": "Subsídio de 6€ por dia", "botao": "Cursos", "imagemRodape": "/imagens/logos-financiamento.png"'),
    '"imagem": "/api/v1/public/imagens/4Dgm_L7Chyj1WvBvtfTZgCkM"', '"imagem": "/imagens/financiada-capa.jpg"')::jsonb END
WHERE pagina = 'inicio'
  AND (coalesce(rascunho::text, '') LIKE '%"etiqueta": "6€ por dia"%' OR coalesce(publicado::text, '') LIKE '%"etiqueta": "6€ por dia"%');
