INSERT INTO catalog_items (id, kind, regime, payload)
SELECT 98001, 'lista_opcoes', 'gold', jsonb_build_object('lista', 'tipos_curso', 'nome', 'Pré-pago')
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items
   WHERE kind = 'lista_opcoes'
     AND payload->>'lista' = 'tipos_curso'
     AND payload->>'nome' = 'Pré-pago'
)
AND NOT EXISTS (SELECT 1 FROM catalog_items WHERE id = 98001);

INSERT INTO catalog_items (id, kind, regime, payload)
SELECT 98002, 'lista_opcoes', 'gold', jsonb_build_object('lista', 'tipos_curso', 'nome', 'Acesso direto')
WHERE NOT EXISTS (
  SELECT 1 FROM catalog_items
   WHERE kind = 'lista_opcoes'
     AND payload->>'lista' = 'tipos_curso'
     AND payload->>'nome' = 'Acesso direto'
)
AND NOT EXISTS (SELECT 1 FROM catalog_items WHERE id = 98002);
