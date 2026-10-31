-- Endereços do Moodle atual (página antiga ena.pt/e-learning) nos cursos que a página de entrada deve mostrar:
-- CCP, E-Formador e Auxiliar de Medicina Dentária. Só onde o campo ainda está vazio (ficha › Oferta).
UPDATE curso_fichas f SET payload = jsonb_set(f.payload, '{moodleUrl}', to_jsonb(m.url))
  FROM cursos_gold c, (VALUES
    ('%formadores%ccp%', 'https://moodlegestao.ena.pt/course/view.php?id=2'),
    ('%e-formador%', 'https://moodlegestao.ena.pt/course/view.php?id=3'),
    ('%medicina dent%', 'https://moodle-dentaria.ena.pt')
  ) AS m(padrao, url)
 WHERE f.regime = 'gold' AND f.curso_id = c.id AND lower(c.nome) LIKE m.padrao
   AND coalesce(f.payload->>'moodleUrl', '') = '';
