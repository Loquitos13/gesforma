-- Pedido do administrador (24-10-2026): apagar o curso Gold de testes #108 «Curso de Teste», que a interface não
-- deixava apagar por ter 1 pagamento (também de testes). Só age se o #108 ainda for esse curso e se nada mais o usar
-- (turmas, formandos, pré-inscrições). O registo na auditoria (com os pagamentos apagados) é a condição dos DELETE.
INSERT INTO audit_log (action, entity, entity_id, meta)
SELECT 'curso.apagar', 'curso', '108', jsonb_build_object(
         'regime', 'gold', 'nome', c.nome, 'origem', 'migracao 201',
         'pagamentosApagados', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'valor', p.valor, 'estado', p.estado)), '[]'::jsonb)
                                  FROM pagamentos p WHERE lower(trim(p.curso)) = 'curso de teste'))
  FROM cursos_gold c
 WHERE c.id = 108 AND lower(trim(c.nome)) = 'curso de teste'
   AND NOT EXISTS (SELECT 1 FROM turmas_gold WHERE lower(trim(curso)) = 'curso de teste')
   AND NOT EXISTS (SELECT 1 FROM formandos_gold WHERE lower(trim(curso)) = 'curso de teste')
   AND NOT EXISTS (SELECT 1 FROM preinscricoes WHERE lower(trim(curso)) = 'curso de teste');

DELETE FROM pagamentos
 WHERE lower(trim(curso)) = 'curso de teste'
   AND EXISTS (SELECT 1 FROM audit_log WHERE action = 'curso.apagar' AND entity_id = '108' AND meta->>'origem' = 'migracao 201');

DELETE FROM cursos_gold
 WHERE id = 108
   AND EXISTS (SELECT 1 FROM audit_log WHERE action = 'curso.apagar' AND entity_id = '108' AND meta->>'origem' = 'migracao 201');
