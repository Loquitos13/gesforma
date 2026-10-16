-- Despesas da Financiada (campos do template de despesas). Os campos ficam em `dados`, validados pelo
-- GesForma (src/partilhado/despesas.ts); a ordem é o número da linha no template.
CREATE TABLE IF NOT EXISTS despesas_fin (
  id serial PRIMARY KEY,
  ordem integer NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS despesas_fin_ordem_idx ON despesas_fin (ordem);

ALTER TABLE despesas_fin ENABLE ROW LEVEL SECURITY;
ALTER TABLE despesas_fin FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS despesas_fin_equipa ON despesas_fin;
CREATE POLICY despesas_fin_equipa ON despesas_fin
  USING (current_setting('gesforma.api', true) = '1' AND app_role() IN ('admin', 'secretaria', 'financiada', 'system'))
  WITH CHECK (current_setting('gesforma.api', true) = '1' AND app_role() IN ('admin', 'secretaria', 'financiada', 'system'));
