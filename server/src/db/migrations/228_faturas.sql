-- Fatura de cada pagamento (inscrição ou compra): a contabilidade anexa o PDF e a fatura segue por email, em anexo, para
-- o email da faturação e para o da pessoa (modelo «fatura», área Contabilidade). Uma por pagamento: outra substitui-a
-- (o ficheiro anterior fica na Drive).
CREATE TABLE IF NOT EXISTS faturas (
  pagamento_id text PRIMARY KEY REFERENCES pagamentos(id) ON DELETE CASCADE,
  numero text NOT NULL DEFAULT '',
  drive_file_id text NOT NULL,
  nome text NOT NULL,
  anexada_em timestamptz NOT NULL DEFAULT now(),
  anexada_por uuid,
  enviada_em timestamptz,
  enviada_para text NOT NULL DEFAULT ''
);

INSERT INTO email_templates (tipo, area, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito) VALUES
('fatura', 'contabilidade', 'Fatura (envio à pessoa)', 'A sua fatura{{numero_fatura}} · {{curso}}',
 '["Obrigado pela sua inscrição. Segue em anexo a fatura{{numero_fatura}} ({{curso}}, € {{valor}}).", "Qualquer dúvida, responda a este email."]'::jsonb,
 '<email>
  <p>Obrigado pela sua inscrição. Segue em anexo a fatura{{numero_fatura}} ({{curso}}, € {{valor}}).</p>
  <p>Qualquer dúvida, responda a este email.</p>
</email>
', '', '', 'contacto')
ON CONFLICT (tipo, area) DO NOTHING;
