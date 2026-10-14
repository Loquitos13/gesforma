-- Formandos: listas e fichas novas.

-- Documentos da Financiada: os antigos só existiam no JSON cifrado (docs_enc). A primeira leitura da
-- lista copia-os para formando_docs (repos/formandosDocs.ts) e marca a ficha como sincronizada,
-- para as contagens de documentos serem feitas em SQL.
ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS docs_sincronizados boolean NOT NULL DEFAULT false;

-- Formandos Gold sem turma ("avulsos") passam a ser fichas de formando como as outras (turma_id NULL),
-- em vez de linhas soltas no catálogo. As linhas de demonstração do arranque não entram.
INSERT INTO formandos_gold (id, nome, apelido, telf, email, inscrito, local, curso, turma, turma_id, estado, pago, valor, metodo, public_id)
SELECT nextval('ops_id_seq')::int,
       trim(c.payload->>'nome'),
       coalesce(trim(c.payload->>'apelido'), ''),
       coalesce(trim(c.payload->>'telf'), ''),
       lower(coalesce(trim(c.payload->>'email'), '')),
       coalesce(c.payload->>'inscrito', ''),
       coalesce(c.payload->>'local', ''),
       coalesce(c.payload->>'curso', ''),
       '',
       NULL,
       'Formando',
       coalesce((c.payload->>'pago')::boolean, false),
       CASE WHEN coalesce(c.payload->>'valor', '') ~ '^[0-9]+(\.[0-9]+)?$' THEN (c.payload->>'valor')::numeric ELSE 0 END,
       CASE WHEN coalesce(trim(c.payload->>'metodo'), '') = '' THEN '-' ELSE trim(c.payload->>'metodo') END,
       md5(random()::text || clock_timestamp()::text || c.id::text)
  FROM catalog_items c
 WHERE c.kind = 'formandos_avulso'
   AND jsonb_typeof(c.payload) = 'object'
   AND coalesce(trim(c.payload->>'nome'), '') <> ''
   AND NOT (c.id BETWEEN 4301 AND 4305 AND lower(coalesce(c.payload->>'email', '')) IN (
     'rui.moreira@gmail.com', 'carla.nogueira@sapo.pt', 'palmeida@outlook.pt', 'sofia.ramos@ena.pt', 'nuno.teixeira88@gmail.com'))
   AND NOT EXISTS (
     SELECT 1 FROM formandos_gold f
      WHERE lower(trim(f.email)) = lower(trim(coalesce(c.payload->>'email', '')))
        AND coalesce(c.payload->>'email', '') <> ''
        AND lower(trim(f.curso)) = lower(trim(coalesce(c.payload->>'curso', ''))));

DELETE FROM catalog_items WHERE kind = 'formandos_avulso';

-- Pesquisas e filtros das listas.
CREATE INDEX IF NOT EXISTS formandos_gold_turma_idx ON formandos_gold (turma_id);
CREATE INDEX IF NOT EXISTS formandos_gold_email_idx ON formandos_gold (lower(email));
CREATE INDEX IF NOT EXISTS formandos_fin_email_idx ON formandos_fin (lower(email));
CREATE INDEX IF NOT EXISTS formando_docs_estado_idx ON formando_docs (regime, formando_id, estado);
