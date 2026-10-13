-- Consentimento RGPD do formulário público, ciclo de vida da ligação pessoal e limite de lembretes.
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS consentimento_em timestamptz;
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS consentimento_ip text NOT NULL DEFAULT '';
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS consentimento_versao text NOT NULL DEFAULT '';
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS docs_token_criado_em timestamptz;
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS docs_token_usado_em timestamptz;
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS lembretes_enviados integer NOT NULL DEFAULT 0;
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS ligacao_reenviada_em timestamptz;

ALTER TABLE preinscricao_docs ADD COLUMN IF NOT EXISTS consentimento_ip text NOT NULL DEFAULT '';
ALTER TABLE preinscricao_docs ADD COLUMN IF NOT EXISTS consentimento_modelo text NOT NULL DEFAULT '';

UPDATE preinscricoes SET docs_token_criado_em = COALESCE(created_at, now())
 WHERE docs_token IS NOT NULL AND docs_token_criado_em IS NULL;
