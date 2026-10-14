-- Índices para as consultas das estatísticas e do funil (comparam emails sem maiúsculas).
CREATE INDEX IF NOT EXISTS pagamentos_email_lower_idx ON pagamentos (lower(email));
CREATE INDEX IF NOT EXISTS pagamentos_turma_idx ON pagamentos (turma_id);
CREATE INDEX IF NOT EXISTS turma_sessoes_turma_idx ON turma_sessoes (regime, turma_id);
