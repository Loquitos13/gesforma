-- «E-learning» é uma modalidade, não um tipo comercial: sai da lista Tipo comercial. Os cursos Gold que o tinham
-- passam a «Pré-pago», que é como o site já os tratava (pagamento e acesso), sem mudar nada para quem se inscreve.
UPDATE cursos_gold SET tipo = 'Pré-pago' WHERE lower(trim(tipo)) = 'e-learning';

UPDATE curso_fichas SET payload = jsonb_set(payload, '{tipo}', '"Pré-pago"'::jsonb)
 WHERE regime = 'gold' AND lower(trim(payload->>'tipo')) = 'e-learning';

DELETE FROM catalog_items
 WHERE kind = 'lista_opcoes' AND payload->>'lista' = 'tipos_curso' AND lower(trim(payload->>'nome')) = 'e-learning';
