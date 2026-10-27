-- O cronograma grava-se por ordem cronológica (data e hora de início; cronogramaOrdem.ts) e com as datas em aaaa-mm-dd:
-- o número de cada sessão é a sua posição entre as lectivas. As sessões acrescentadas à mão iam para o fim e ficavam
-- com o número errado; aqui arrumam-se os cronogramas já gravados e renumeram-se as sessões.
UPDATE turmas_gold t SET cronograma = (
  SELECT jsonb_agg(y.e ORDER BY (y.d IS NULL), y.d, y.h, y.o)
    FROM (
      SELECT CASE WHEN jsonb_typeof(x.e) = 'object' AND x.e->>'data' ~ '^\d{2}[-/]\d{2}[-/]\d{4}$'
               THEN jsonb_set(x.e, '{data}', to_jsonb(substr(x.e->>'data', 7, 4) || '-' || substr(x.e->>'data', 4, 2) || '-' || substr(x.e->>'data', 1, 2)))
               ELSE x.e END AS e,
             CASE WHEN jsonb_typeof(x.e) <> 'object' THEN NULL
                  WHEN x.e->>'data' ~ '^\d{2}[-/]\d{2}[-/]\d{4}$' THEN substr(x.e->>'data', 7, 4) || '-' || substr(x.e->>'data', 4, 2) || '-' || substr(x.e->>'data', 1, 2)
                  WHEN x.e->>'data' ~ '^\d{4}-\d{2}-\d{2}' THEN x.e->>'data' END AS d,
             CASE WHEN jsonb_typeof(x.e) = 'object' THEN lpad(coalesce(x.e->>'horaInicio', ''), 5, '0') ELSE '' END AS h,
             x.o
        FROM jsonb_array_elements(t.cronograma) WITH ORDINALITY AS x(e, o)
    ) y
) WHERE jsonb_typeof(t.cronograma) = 'array' AND jsonb_array_length(t.cronograma) > 1;

UPDATE turmas_fin t SET cronograma = (
  SELECT jsonb_agg(y.e ORDER BY (y.d IS NULL), y.d, y.h, y.o)
    FROM (
      SELECT CASE WHEN jsonb_typeof(x.e) = 'object' AND x.e->>'data' ~ '^\d{2}[-/]\d{2}[-/]\d{4}$'
               THEN jsonb_set(x.e, '{data}', to_jsonb(substr(x.e->>'data', 7, 4) || '-' || substr(x.e->>'data', 4, 2) || '-' || substr(x.e->>'data', 1, 2)))
               ELSE x.e END AS e,
             CASE WHEN jsonb_typeof(x.e) <> 'object' THEN NULL
                  WHEN x.e->>'data' ~ '^\d{2}[-/]\d{2}[-/]\d{4}$' THEN substr(x.e->>'data', 7, 4) || '-' || substr(x.e->>'data', 4, 2) || '-' || substr(x.e->>'data', 1, 2)
                  WHEN x.e->>'data' ~ '^\d{4}-\d{2}-\d{2}' THEN x.e->>'data' END AS d,
             CASE WHEN jsonb_typeof(x.e) = 'object' THEN lpad(coalesce(x.e->>'horaInicio', ''), 5, '0') ELSE '' END AS h,
             x.o
        FROM jsonb_array_elements(t.cronograma) WITH ORDINALITY AS x(e, o)
    ) y
) WHERE jsonb_typeof(t.cronograma) = 'array' AND jsonb_array_length(t.cronograma) > 1;

-- Renumerar (a mesma conta de renumerarSessoes): posição de cada sessão entre as lectivas do cronograma.
WITH lect AS (
  SELECT 'gold'::text AS regime, t.id AS turma_id, x.e->>'id' AS sid, row_number() OVER (PARTITION BY t.id ORDER BY x.o)::int AS n
    FROM turmas_gold t
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t.cronograma) = 'array' THEN t.cronograma ELSE '[]'::jsonb END) WITH ORDINALITY AS x(e, o)
   WHERE jsonb_typeof(x.e) = 'object' AND coalesce(x.e->>'modalidade', 'presencial') IN ('presencial', 'sincrona')
  UNION ALL
  SELECT 'fin'::text, t.id, x.e->>'id', row_number() OVER (PARTITION BY t.id ORDER BY x.o)::int
    FROM turmas_fin t
    CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(t.cronograma) = 'array' THEN t.cronograma ELSE '[]'::jsonb END) WITH ORDINALITY AS x(e, o)
   WHERE jsonb_typeof(x.e) = 'object' AND coalesce(x.e->>'modalidade', 'presencial') IN ('presencial', 'sincrona')
)
UPDATE turma_sessoes ts SET sessao_n = (SELECT min(lect.n) FROM lect WHERE lect.regime = ts.regime AND lect.turma_id = ts.turma_id AND lect.sid = ts.sessao_id)
 WHERE ts.sessao_id IS NOT NULL;
