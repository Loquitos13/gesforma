-- Planos de sessão e folhas de presenças assinados com assinatura qualificada (Cartão de Cidadão / Chave Móvel Digital,
-- na app Autenticação.gov). Guarda o PDF original emitido para assinar, o PDF com as assinaturas e quem assinou.
CREATE TABLE IF NOT EXISTS sessao_pdfs_assinados (
  regime text NOT NULL,
  turma_id integer NOT NULL,
  sessao_id text NOT NULL,
  documento text NOT NULL CHECK (documento IN ('plano', 'folha')),
  conteudo_hash text NOT NULL,
  original bytea NOT NULL,
  pdf bytea NOT NULL,
  assinaturas jsonb NOT NULL DEFAULT '[]',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (regime, turma_id, sessao_id, documento)
);
