-- Dados do formando da Financiada para o financiamento (execução física): os valores das listas do template
-- oficial («código - descrição»), o número SIGO e o NIF da entidade empregadora. Os identificadores pessoais
-- (NIF, NISS, data de nascimento, código postal e documentos de estrangeiro) ficam cifrados no pacote PII
-- da ficha (formandos_fin.pii_enc), não aqui.
CREATE TABLE IF NOT EXISTS formando_fin_financiamento (
  formando_id integer PRIMARY KEY REFERENCES formandos_fin(id) ON DELETE CASCADE,
  genero text NOT NULL DEFAULT '',
  nacionalidade text NOT NULL DEFAULT '',
  situacao_emprego_entrada text NOT NULL DEFAULT '',
  situacao_emprego_saida text NOT NULL DEFAULT '',
  habilitacoes_entrada text NOT NULL DEFAULT '',
  habilitacoes_saida text NOT NULL DEFAULT '',
  procura_emprego_apos text NOT NULL DEFAULT '',
  estuda_entrada text NOT NULL DEFAULT '',
  estuda_apos text NOT NULL DEFAULT '',
  numero_sigo text NOT NULL DEFAULT '',
  nif_entidade_empregadora text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE formando_fin_financiamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE formando_fin_financiamento FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS formando_fin_financiamento_equipa ON formando_fin_financiamento;
CREATE POLICY formando_fin_financiamento_equipa ON formando_fin_financiamento
  USING (current_setting('gesforma.api', true) = '1' AND app_role() IN ('admin', 'secretaria', 'financiada', 'system'))
  WITH CHECK (current_setting('gesforma.api', true) = '1' AND app_role() IN ('admin', 'secretaria', 'financiada', 'system'));
