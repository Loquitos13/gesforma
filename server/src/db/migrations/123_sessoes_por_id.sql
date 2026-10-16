-- Os dados de cada sessão (plano, sumário, presenças) passam a ligar-se ao id estável da sessão do cronograma.
-- sessao_n fica só como número de exibição (posição lectiva actual) e recalcula-se sempre que o cronograma muda.

-- 1) Sessões do cronograma sem id, ou com id repetido, recebem um id estável.
UPDATE turmas_gold t SET cronograma = sub.novo
  FROM (
    SELECT t2.id, jsonb_agg(
             CASE WHEN jsonb_typeof(x.e) = 'object' AND (coalesce(x.e->>'id', '') = '' OR x.rep > 1)
                  THEN x.e || jsonb_build_object('id', 'mig-' || t2.id || '-' || x.o)
                  ELSE x.e END
             ORDER BY x.o) AS novo
      FROM turmas_gold t2
      CROSS JOIN LATERAL (
        SELECT a.e, a.o, row_number() OVER (PARTITION BY a.e->>'id' ORDER BY a.o) AS rep
          FROM jsonb_array_elements(t2.cronograma) WITH ORDINALITY AS a(e, o)
      ) x
     WHERE jsonb_typeof(t2.cronograma) = 'array'
     GROUP BY t2.id
  ) sub
 WHERE sub.id = t.id AND sub.novo IS DISTINCT FROM t.cronograma;

UPDATE turmas_fin t SET cronograma = sub.novo
  FROM (
    SELECT t2.id, jsonb_agg(
             CASE WHEN jsonb_typeof(x.e) = 'object' AND (coalesce(x.e->>'id', '') = '' OR x.rep > 1)
                  THEN x.e || jsonb_build_object('id', 'mig-' || t2.id || '-' || x.o)
                  ELSE x.e END
             ORDER BY x.o) AS novo
      FROM turmas_fin t2
      CROSS JOIN LATERAL (
        SELECT a.e, a.o, row_number() OVER (PARTITION BY a.e->>'id' ORDER BY a.o) AS rep
          FROM jsonb_array_elements(t2.cronograma) WITH ORDINALITY AS a(e, o)
      ) x
     WHERE jsonb_typeof(t2.cronograma) = 'array'
     GROUP BY t2.id
  ) sub
 WHERE sub.id = t.id AND sub.novo IS DISTINCT FROM t.cronograma;

ALTER TABLE turma_sessoes ADD COLUMN IF NOT EXISTS sessao_id text;

ALTER TABLE turma_sessoes ADD COLUMN IF NOT EXISTS sessao_n_orfa integer;

-- 2) Cada linha recebe o id da sessão lectiva (presencial ou síncrona) que hoje ocupa a sua posição.
UPDATE turma_sessoes ts SET sessao_id = l.sid
  FROM (
    SELECT 'gold'::text AS regime, t.id AS turma_id, x.e->>'id' AS sid, row_number() OVER (PARTITION BY t.id ORDER BY x.o)::int AS n
      FROM turmas_gold t
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t.cronograma) = 'array' THEN t.cronograma ELSE '[]'::jsonb END) WITH ORDINALITY AS x(e, o)
     WHERE jsonb_typeof(x.e) = 'object' AND coalesce(x.e->>'modalidade', 'presencial') IN ('presencial', 'sincrona')
    UNION ALL
    SELECT 'fin'::text, t.id, x.e->>'id', row_number() OVER (PARTITION BY t.id ORDER BY x.o)::int
      FROM turmas_fin t
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t.cronograma) = 'array' THEN t.cronograma ELSE '[]'::jsonb END) WITH ORDINALITY AS x(e, o)
     WHERE jsonb_typeof(x.e) = 'object' AND coalesce(x.e->>'modalidade', 'presencial') IN ('presencial', 'sincrona')
  ) l
 WHERE ts.regime = l.regime AND ts.turma_id = l.turma_id AND ts.sessao_n = l.n;

ALTER TABLE turma_sessoes DROP CONSTRAINT IF EXISTS turma_sessoes_pkey;

ALTER TABLE turma_sessoes ALTER COLUMN sessao_n DROP NOT NULL;

-- 3) Linhas cuja posição já não existe no cronograma: não se apagam; ficam sem sessão e guardam o número antigo.
UPDATE turma_sessoes SET sessao_n_orfa = sessao_n, sessao_n = NULL WHERE sessao_id IS NULL;

COMMENT ON COLUMN turma_sessoes.sessao_n_orfa IS 'Migração 123: número antigo de linhas cuja posição já não existia no cronograma. Ficaram sem sessao_id (dados guardados, fora das sessões).';

COMMENT ON COLUMN turma_sessoes.sessao_n IS 'Número de exibição: posição lectiva actual da sessao_id no cronograma (recalculado em renumerarSessoes).';

CREATE UNIQUE INDEX IF NOT EXISTS turma_sessoes_sessao_id_uq ON turma_sessoes (regime, turma_id, sessao_id);
