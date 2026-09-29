ALTER TABLE preinscricao_docs ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'pendente';
ALTER TABLE preinscricao_docs ADD COLUMN IF NOT EXISTS observacao text NOT NULL DEFAULT '';
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS docs_fechado_em timestamptz;

CREATE TABLE IF NOT EXISTS doc_alertas (
  id text PRIMARY KEY,
  preinscricao_id integer NOT NULL,
  dispensada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS doc_alertas_abertas_idx ON doc_alertas (preinscricao_id) WHERE dispensada_em IS NULL;

CREATE TABLE IF NOT EXISTS curso_ficheiros (
  id text PRIMARY KEY,
  regime text NOT NULL,
  curso_id integer NOT NULL,
  ambito text NOT NULL,
  requisito_id text NOT NULL DEFAULT '',
  pessoa_id integer,
  pessoa_nome text NOT NULL DEFAULT '',
  nome text NOT NULL,
  drive_file_id text,
  drive_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS curso_ficheiros_curso_idx ON curso_ficheiros (regime, curso_id);

UPDATE email_rules
   SET gatilho_label = 'Pré-inscrição promovida'
 WHERE gatilho_label = 'Lead passou a pré-inscrito';

UPDATE preinscricoes p
   SET estado = '1º Contacto'
 WHERE p.estado = 'Não contactado'
   AND EXISTS (
     SELECT 1
       FROM automation_events e
       JOIN email_jobs j ON j.event_id = e.id
      WHERE e.type = 'preinscricao.created'
        AND e.payload->>'preinscricaoId' = p.id::text
   );
