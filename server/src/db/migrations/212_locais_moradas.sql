-- Moradas de cada localidade (notas da Débora, 30-10-2026): aparecem no «Local de realização» do cronograma e na
-- impressão. Novas moradas acrescentam-se em Edição de Cursos › Locais. Amadora entra como novo local.
UPDATE catalog_items SET payload = jsonb_set(payload, '{morada}', to_jsonb(m.morada))
  FROM (VALUES
    ('lisboa', 'Av. do Brasil, 1, 1749-008 Lisboa'),
    ('v.n.gaia', 'R. do Conselheiro Veloso da Cruz, 524, 4400-092 Vila Nova de Gaia'),
    ('v.n. gaia', 'R. do Conselheiro Veloso da Cruz, 524, 4400-092 Vila Nova de Gaia'),
    ('vila nova de gaia', 'R. do Conselheiro Veloso da Cruz, 524, 4400-092 Vila Nova de Gaia'),
    ('gaia', 'R. do Conselheiro Veloso da Cruz, 524, 4400-092 Vila Nova de Gaia'),
    ('braga', 'Rua de Barros, n.º 95 – Gualtar, 4710-058 Braga'),
    ('aveiro', 'Largo Capitão Maia Magalhães, 3800-124 Aveiro (Bombeiros Novos de Aveiro)')
  ) AS m(nome, morada)
 WHERE catalog_items.kind = 'locais' AND lower(trim(catalog_items.payload->>'nome')) = m.nome;
INSERT INTO catalog_items (id, kind, regime, payload)
SELECT nextval('ops_id_seq'), 'locais', 'gold', jsonb_build_object(
  'nome', 'Lisboa/Amadora', 'morada', 'R. Elias Garcia, 29 – Venda Nova, 2700-312 Amadora',
  'salas', 1, 'turmas', 0, 'status', 'Ativo')
 WHERE NOT EXISTS (SELECT 1 FROM catalog_items WHERE kind = 'locais' AND lower(payload->>'nome') LIKE '%amadora%');
