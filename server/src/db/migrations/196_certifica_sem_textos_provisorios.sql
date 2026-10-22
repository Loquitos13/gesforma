-- A migração 190 preencheu, na página Certificação DGERT, os campos que estavam vazios com textos provisórios.
-- Quem está a tratar da página deixou-os vazios de propósito: voltam a ficar vazios, mas só os que ainda têm
-- exatamente o texto provisório (o que entretanto foi escrito no backoffice fica). Os dois cartões ficam.
UPDATE servicos SET dados = dados
    || CASE WHEN dados->>'etiqueta' = 'Certifica' THEN '{"etiqueta": ""}'::jsonb ELSE '{}'::jsonb END
    || CASE WHEN dados->>'tituloDetalhe' = 'Que certificação procura?' THEN '{"tituloDetalhe": ""}'::jsonb ELSE '{}'::jsonb END
    || CASE WHEN dados->>'detalhe' = E'A certificação DGERT reconhece a qualidade de uma entidade formadora e é, muitas vezes, condição para aceder a financiamento e a clientes empresariais.\nAcompanhamos duas situações: entidades que ainda não são certificadas e querem sê-lo, e entidades já certificadas que querem certificar novos cursos e áreas de formação. Escolha abaixo a que se aplica a si.'
         THEN '{"detalhe": ""}'::jsonb ELSE '{}'::jsonb END
    || CASE WHEN dados->>'ctaTitulo' = 'Não sabe qual é o seu caso?' THEN '{"ctaTitulo": ""}'::jsonb ELSE '{}'::jsonb END
    || CASE WHEN dados->>'ctaTexto' = 'Conte-nos a situação da sua entidade. Indicamos o caminho e enviamos uma proposta.' THEN '{"ctaTexto": ""}'::jsonb ELSE '{}'::jsonb END,
  atualizado_em = now()
WHERE slug = 'certificacao-dgert-de-entidades-formadoras';
