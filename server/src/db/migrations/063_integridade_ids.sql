-- Ligações por id em vez de nome, e fecho também na Gold.
ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS curso_id integer;
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS curso_id integer;
ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS fechada_em timestamptz;
ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS fechada_por uuid;
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS reaberta_em timestamptz;
ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS reaberta_em timestamptz;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS formando_id integer;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS turma_id integer;

UPDATE turmas_gold t SET curso_id = c.id
  FROM cursos_gold c
 WHERE t.curso_id IS NULL AND lower(trim(c.nome)) = lower(trim(t.curso));

UPDATE turmas_fin t SET curso_id = c.id
  FROM cursos_fin c
 WHERE t.curso_id IS NULL
   AND (lower(trim(c.nome_comercial)) = lower(trim(t.curso)) OR lower(trim(c.ufcd)) = lower(trim(t.curso)));

UPDATE formandos_gold f SET turma_id = t.id
  FROM turmas_gold t
 WHERE f.turma_id IS NULL AND f.turma <> '' AND lower(trim(t.nome)) = lower(trim(f.turma));

UPDATE formandos_fin f SET turma_id = t.id
  FROM turmas_fin t
 WHERE f.turma_id IS NULL AND f.turma <> '' AND lower(trim(t.nome)) = lower(trim(f.turma));

-- Um pagamento liga-se ao formando Gold com o mesmo email e o mesmo curso, quando é único.
UPDATE pagamentos p SET formando_id = f.id, turma_id = f.turma_id
  FROM formandos_gold f
 WHERE p.formando_id IS NULL
   AND p.email <> '' AND lower(f.email) = lower(p.email)
   AND lower(trim(f.curso)) = lower(trim(p.curso))
   AND (SELECT count(*) FROM formandos_gold g WHERE lower(g.email) = lower(p.email) AND lower(trim(g.curso)) = lower(trim(p.curso))) = 1;

CREATE INDEX IF NOT EXISTS formandos_gold_turma_idx ON formandos_gold (turma_id);
CREATE INDEX IF NOT EXISTS formandos_fin_turma_idx ON formandos_fin (turma_id);
CREATE INDEX IF NOT EXISTS pagamentos_formando_idx ON pagamentos (formando_id);
