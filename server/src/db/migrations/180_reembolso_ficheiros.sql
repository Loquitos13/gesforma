-- Ficheiros do reembolso da Financiada: cada turma tem uma só cópia de cada (execução física e despesas)
-- na sua pasta da Drive. A linha aponta para o ficheiro actual; ao actualizar, o anterior apaga-se.
-- `impressao` é o resumo dos dados com que o ficheiro foi gerado (se os dados mudam, está desactualizado).
CREATE TABLE IF NOT EXISTS reembolso_ficheiros (
  turma_id integer NOT NULL REFERENCES turmas_fin(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('execucao-fisica', 'despesas')),
  drive_file_id text NOT NULL,
  impressao text NOT NULL DEFAULT '',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid,
  PRIMARY KEY (turma_id, tipo)
);

ALTER TABLE reembolso_ficheiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE reembolso_ficheiros FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS reembolso_ficheiros_equipa ON reembolso_ficheiros;
CREATE POLICY reembolso_ficheiros_equipa ON reembolso_ficheiros
  USING (current_setting('gesforma.api', true) = '1' AND app_role() IN ('admin', 'secretaria', 'financiada', 'system'))
  WITH CHECK (current_setting('gesforma.api', true) = '1' AND app_role() IN ('admin', 'secretaria', 'financiada', 'system'));
