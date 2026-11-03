-- Receitas de teste de agosto e setembro de 2026 (dados de demonstração que entraram com a base vazia): saem dos
-- pagamentos e dos totais. Só se apagam se ainda forem exactamente as linhas de teste (mesmo id, nome, valor e data).
DELETE FROM pagamentos p
 USING (VALUES
   ('TRX-17550', 'Tiago Bento', 125::numeric, '2026-09-03 16:21'),
   ('TRX-17539', 'Aline Cristina Pereira', 120::numeric, '2026-09-04 11:07'),
   ('TRX-17536', 'Priscila Damasceno', 300::numeric, '2026-09-04 09:52'),
   ('TRX-17530', 'Maria Mota', 120::numeric, '2026-09-01 09:36'),
   ('TRX-17522', 'Hugo Baldaia', 145::numeric, '2026-08-31 14:32')
 ) AS t(id, nome, valor, data)
 WHERE p.id = t.id AND p.nome = t.nome AND p.valor::numeric = t.valor AND p.data = t.data;
