ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS turma_escolhida_id integer;
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS percurso_concluido_em timestamptz;
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS validada_em timestamptz;
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS recusa_motivo text NOT NULL DEFAULT '';

-- A ligação só fecha quando a secretaria valida a pré-inscrição.
UPDATE preinscricoes SET docs_fechado_em = NULL WHERE validada_em IS NULL;

UPDATE email_templates
   SET cta_href = '{{documentos_url}}',
       cta_ambito = 'documentos',
       body_xml = regexp_replace(body_xml, '(<cta\b[^>]*\bhref=")[^"]*(")', '\1{{documentos_url}}\2'),
       updated_at = now()
 WHERE tipo = 'welcome'
   AND (
     cta_href IS DISTINCT FROM '{{documentos_url}}'
     OR COALESCE(body_xml, '') NOT LIKE '%href="{{documentos_url}}"%'
   );
