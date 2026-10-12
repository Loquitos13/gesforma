ALTER TABLE preinscricao_docs ADD COLUMN IF NOT EXISTS validated_by uuid;
ALTER TABLE preinscricao_docs ADD COLUMN IF NOT EXISTS validated_at timestamptz;

ALTER TABLE formando_docs ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'pendente';
ALTER TABLE formando_docs ADD COLUMN IF NOT EXISTS observacao text NOT NULL DEFAULT '';
ALTER TABLE formando_docs ADD COLUMN IF NOT EXISTS validated_by uuid;
ALTER TABLE formando_docs ADD COLUMN IF NOT EXISTS validated_at timestamptz;

UPDATE formando_docs SET estado = 'validado', validated_at = COALESCE(validated_at, updated_at)
  WHERE ok = true AND estado = 'pendente';

ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS docs_token text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS formandos_fin_docs_token_uq ON formandos_fin (docs_token) WHERE docs_token <> '';

ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS fechada_em timestamptz;
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS fechada_por uuid;
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS relatorio_execucao jsonb NOT NULL DEFAULT '{}';
