-- CRM de pré-inscrições: índices para as filas, os filtros e as contagens de documentos da lista.

CREATE INDEX IF NOT EXISTS preinscricao_docs_estado_idx ON preinscricao_docs (preinscricao_id, estado);
CREATE INDEX IF NOT EXISTS preinscricoes_regime_estado_idx ON preinscricoes (regime, estado);
CREATE INDEX IF NOT EXISTS preinscricoes_email_lower_idx ON preinscricoes (lower(email));
CREATE INDEX IF NOT EXISTS preinscricoes_proximo_idx ON preinscricoes (proximo_contacto);
CREATE INDEX IF NOT EXISTS preinscricoes_docs_token_idx ON preinscricoes (docs_token);
