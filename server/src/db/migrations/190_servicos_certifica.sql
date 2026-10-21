-- Página Certifica (pedido da Carla): a página da certificação DGERT passa a geral, com dois cartões que levam a dois
-- serviços próprios, cada um com a sua página e o seu formulário de pedido de proposta:
--   /empresas/certificacao-inicial          (entidades formadoras que querem ser certificadas)
--   /empresas/alargamento-da-certificacao   (entidades já certificadas: novos cursos / áreas de formação)
-- Os dois novos ficam «dentro» da página Certifica (dados.pai): não entram nos cartões da página Empresas e o «Voltar» leva à Certifica.
-- Os textos são provisórios (o documento da Carla não estava acessível) e mudam-se em Gestão › Empresas / Business.
-- Nada do que já foi escrito se perde: só se preenche o que está vazio ou ainda tem o texto inicial da migração 125.

INSERT INTO servicos (slug, ordem, ativo, dados)
SELECT 'certificacao-inicial',
  COALESCE((SELECT ordem FROM servicos WHERE slug = 'certificacao-dgert-de-entidades-formadoras'), (SELECT COALESCE(MAX(ordem), 0) FROM servicos)) + 1,
  true,
  jsonb_build_object(
    'titulo', 'Certificação Inicial',
    'etiqueta', 'Certifica',
    'texto', 'Preparamos a certificação DGERT da sua entidade formadora, do diagnóstico à decisão.',
    'pontos', E'Diagnóstico dos requisitos de certificação\nDossiê de candidatura completo\nAcompanhamento até à decisão da DGERT',
    'tituloDetalhe', 'Certificação de entidades formadoras',
    'detalhe', E'A certificação DGERT reconhece que uma entidade tem as condições para desenvolver formação com qualidade: estrutura, recursos, processos e equipa. É também, muitas vezes, condição para aceder a financiamento e a clientes empresariais.\nAcompanhamos a sua entidade em todo o processo: avaliamos o que já existe, preparamos o que falta e organizamos o dossiê de candidatura, até à decisão.',
    'rotulo', 'Pedir proposta', 'ligacao', '#proposta',
    'imagem', '', 'imagens', '[]'::jsonb, 'video', '', 'logos', '[]'::jsonb, 'capa', '',
    'cartoes', jsonb_build_array(
      jsonb_build_object('titulo', '1. Diagnóstico', 'texto', 'Analisamos a entidade face aos requisitos de certificação e indicamos o que falta.', 'rotulo', '', 'ligacao', ''),
      jsonb_build_object('titulo', '2. Preparação', 'texto', 'Preparamos os procedimentos, os documentos e as evidências pedidas.', 'rotulo', '', 'ligacao', ''),
      jsonb_build_object('titulo', '3. Candidatura', 'texto', 'Organizamos o dossiê e submetemos a candidatura à DGERT.', 'rotulo', '', 'ligacao', ''),
      jsonb_build_object('titulo', '4. Acompanhamento', 'texto', 'Respondemos aos pedidos de esclarecimento até à decisão.', 'rotulo', '', 'ligacao', '')
    ),
    'ctaTitulo', 'Quer certificar a sua entidade formadora?',
    'ctaTexto', 'Conte-nos em que ponto está a sua entidade. Respondemos com uma proposta.',
    'pai', CASE WHEN EXISTS (SELECT 1 FROM servicos WHERE slug = 'certificacao-dgert-de-entidades-formadoras') THEN 'certificacao-dgert-de-entidades-formadoras' ELSE '' END
  )
ON CONFLICT (slug) DO NOTHING;

INSERT INTO servicos (slug, ordem, ativo, dados)
SELECT 'alargamento-da-certificacao',
  COALESCE((SELECT ordem FROM servicos WHERE slug = 'certificacao-dgert-de-entidades-formadoras'), (SELECT COALESCE(MAX(ordem), 0) FROM servicos)) + 2,
  true,
  jsonb_build_object(
    'titulo', 'Alargamento da certificação',
    'etiqueta', 'Certifica',
    'texto', 'Alargamos a certificação DGERT da sua entidade a novas áreas de educação e formação, para certificar novos cursos.',
    'pontos', E'Análise das novas áreas de formação\nPedido de alargamento preparado por nós\nAcompanhamento junto da DGERT',
    'tituloDetalhe', 'Certificação de novos cursos e áreas de formação',
    'detalhe', E'A certificação DGERT é dada por áreas de educação e formação. Quando a sua entidade quer passar a dar cursos noutras áreas, precisa de alargar a certificação.\nAnalisamos as áreas que pretende, verificamos os recursos e a equipa formativa para cada uma e preparamos o pedido de alargamento, até à decisão.',
    'rotulo', 'Pedir proposta', 'ligacao', '#proposta',
    'imagem', '', 'imagens', '[]'::jsonb, 'video', '', 'logos', '[]'::jsonb, 'capa', '',
    'cartoes', jsonb_build_array(
      jsonb_build_object('titulo', '1. Novas áreas', 'texto', 'Definimos consigo as áreas de educação e formação e os cursos a certificar.', 'rotulo', '', 'ligacao', ''),
      jsonb_build_object('titulo', '2. Requisitos', 'texto', 'Verificamos formadores, espaços, recursos e programas para cada área.', 'rotulo', '', 'ligacao', ''),
      jsonb_build_object('titulo', '3. Pedido', 'texto', 'Preparamos e submetemos o pedido de alargamento à DGERT.', 'rotulo', '', 'ligacao', ''),
      jsonb_build_object('titulo', '4. Acompanhamento', 'texto', 'Respondemos aos pedidos de esclarecimento até à decisão.', 'rotulo', '', 'ligacao', '')
    ),
    'ctaTitulo', 'Quer certificar novos cursos?',
    'ctaTexto', 'Diga-nos que áreas de formação quer acrescentar. Respondemos com uma proposta.',
    'pai', CASE WHEN EXISTS (SELECT 1 FROM servicos WHERE slug = 'certificacao-dgert-de-entidades-formadoras') THEN 'certificacao-dgert-de-entidades-formadoras' ELSE '' END
  )
ON CONFLICT (slug) DO NOTHING;

-- Página principal (Certifica): título e descrição gerais só se ainda forem os da migração 125.
UPDATE servicos SET dados = dados || jsonb_build_object(
    'titulo', 'Certificação DGERT',
    'texto', 'Ajudamos entidades formadoras a obter a certificação DGERT e a alargá-la a novos cursos e áreas de formação.'),
  atualizado_em = now()
WHERE slug = 'certificacao-dgert-de-entidades-formadoras'
  AND dados->>'titulo' = 'Certificação DGERT de entidades formadoras'
  AND dados->>'texto' = 'Elaboramos o dossiê de certificação de entidades formadoras ou academias de formação pela DGERT.';

-- Campos vazios da página principal: etiqueta, texto completo e faixa final.
UPDATE servicos SET dados = dados
    || CASE WHEN COALESCE(dados->>'etiqueta', '') = '' THEN '{"etiqueta": "Certifica"}'::jsonb ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(dados->>'tituloDetalhe', '') = '' THEN '{"tituloDetalhe": "Que certificação procura?"}'::jsonb ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(dados->>'detalhe', '') = '' THEN jsonb_build_object('detalhe',
         E'A certificação DGERT reconhece a qualidade de uma entidade formadora e é, muitas vezes, condição para aceder a financiamento e a clientes empresariais.\nAcompanhamos duas situações: entidades que ainda não são certificadas e querem sê-lo, e entidades já certificadas que querem certificar novos cursos e áreas de formação. Escolha abaixo a que se aplica a si.')
       ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(dados->>'ctaTitulo', '') = '' THEN '{"ctaTitulo": "Não sabe qual é o seu caso?"}'::jsonb ELSE '{}'::jsonb END
    || CASE WHEN COALESCE(dados->>'ctaTexto', '') = '' THEN '{"ctaTexto": "Conte-nos a situação da sua entidade. Indicamos o caminho e enviamos uma proposta."}'::jsonb ELSE '{}'::jsonb END,
  atualizado_em = now()
WHERE slug = 'certificacao-dgert-de-entidades-formadoras';

-- Os dois cartões, cada um com ligação à sua página. Sem cartões: ficam estes. Com cartões já escritos: juntam-se no fim
-- (só os que ainda não lá estão, e sem passar dos 12).
UPDATE servicos SET dados = jsonb_set(dados, '{cartoes}', COALESCE(CASE WHEN jsonb_typeof(dados->'cartoes') = 'array' THEN dados->'cartoes' END, '[]'::jsonb) || (
    SELECT COALESCE(jsonb_agg(c), '[]'::jsonb) FROM jsonb_array_elements(jsonb_build_array(
      jsonb_build_object('titulo', 'Certificação Inicial', 'texto', 'Para entidades formadoras que querem obter a certificação DGERT pela primeira vez.', 'rotulo', 'Saber mais', 'ligacao', '/empresas/certificacao-inicial'),
      jsonb_build_object('titulo', 'Alargamento', 'texto', 'Para entidades já certificadas que querem certificar novos cursos e áreas de formação.', 'rotulo', 'Saber mais', 'ligacao', '/empresas/alargamento-da-certificacao')
    )) AS c
    WHERE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(dados->'cartoes') = 'array' THEN dados->'cartoes' ELSE '[]'::jsonb END) AS x
      WHERE x->>'ligacao' = c->>'ligacao')
  )),
  atualizado_em = now()
WHERE slug = 'certificacao-dgert-de-entidades-formadoras'
  AND (CASE WHEN jsonb_typeof(dados->'cartoes') = 'array' THEN jsonb_array_length(dados->'cartoes') ELSE 0 END) <= 10;
