ALTER TABLE turma_certificados ADD COLUMN IF NOT EXISTS ficheiro_id text NOT NULL DEFAULT '';
ALTER TABLE turma_certificados ADD COLUMN IF NOT EXISTS ficheiro_nome text NOT NULL DEFAULT '';
ALTER TABLE turma_certificados ADD COLUMN IF NOT EXISTS ficheiro_url text NOT NULL DEFAULT '';
