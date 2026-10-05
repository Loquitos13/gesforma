ALTER TABLE cursos_gold ADD COLUMN IF NOT EXISTS docs_preinscricao jsonb;
ALTER TABLE cursos_fin ADD COLUMN IF NOT EXISTS docs_preinscricao jsonb;
