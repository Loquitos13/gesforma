-- Dados de faturação pedidos por email depois da inscrição Gold concluída (ligação pessoal própria).
-- Os dados (nome/empresa, NIF, morada fiscal, código postal, email da fatura) ficam cifrados.
CREATE TABLE IF NOT EXISTS preinscricao_faturacao (
  preinscricao_id integer PRIMARY KEY REFERENCES preinscricoes(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  dados_enc text,
  pedido_em timestamptz NOT NULL DEFAULT now(),
  preenchido_em timestamptz
);

ALTER TABLE preinscricao_faturacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE preinscricao_faturacao FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS preinscricao_faturacao_equipa ON preinscricao_faturacao;
CREATE POLICY preinscricao_faturacao_equipa ON preinscricao_faturacao
  USING (current_setting('gesforma.api', true) = '1' AND app_role() IN ('admin', 'secretaria', 'financiada', 'system'))
  WITH CHECK (current_setting('gesforma.api', true) = '1' AND app_role() IN ('admin', 'secretaria', 'financiada', 'system'));

INSERT INTO email_templates (tipo, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito) VALUES
('faturacao', 'Dados de faturação', 'Dados para a fatura · {{curso}} | ENA',
 '["A sua inscrição no curso {{curso}} está concluída. Obrigado!", "Para emitirmos a fatura, indique os dados de faturação (nome ou empresa, NIF, morada fiscal, código postal e o email para onde enviamos a fatura) no botão abaixo."]'::jsonb,
 E'<email>\n  <p>A sua inscrição no curso {{curso}} está concluída. Obrigado!</p>\n  <p>Para emitirmos a fatura, indique os dados de faturação (nome ou empresa, NIF, morada fiscal, código postal e o email para onde enviamos a fatura) no botão abaixo.</p>\n  <cta ambito="contacto" href="{{faturacao_url}}">Preencher dados de faturação</cta>\n</email>\n',
 'Preencher dados de faturação', '{{faturacao_url}}', 'contacto')
ON CONFLICT (tipo) DO NOTHING;
