-- Comprovativo de pagamento à espera dos dados de faturação. A ligação pessoal pede os dados de faturação logo a seguir
-- ao comprovativo; o email à contabilidade (comprovativo em anexo e dados de faturação no corpo) sai quando a pessoa os
-- confirma, ou ao fim do prazo de Configurações › Entidade com os dados da ficha por confirmar. Entretanto, a pessoa
-- recebe um lembrete para os confirmar.
CREATE TABLE IF NOT EXISTS comprovativo_contabilidade (
  preinscricao_id integer PRIMARY KEY REFERENCES preinscricoes(id) ON DELETE CASCADE,
  drive_file_id text NOT NULL,
  recebido_em timestamptz NOT NULL DEFAULT now(),
  -- Email à contabilidade deste comprovativo; com os dados de faturação confirmados ou ainda por confirmar.
  enviado_em timestamptz,
  enviado_com_dados boolean NOT NULL DEFAULT false,
  -- Lembrete à pessoa para confirmar os dados de faturação (um por pré-inscrição).
  lembrete_em timestamptz,
  -- Depois de uma falha (email, Drive), a volta automática só tenta de novo a partir daqui.
  tentar_depois timestamptz
);
CREATE INDEX IF NOT EXISTS comprovativo_contabilidade_pendentes_idx ON comprovativo_contabilidade (recebido_em)
  WHERE enviado_em IS NULL OR lembrete_em IS NULL;

-- Lembrete à pessoa: confirmar os dados de faturação (Gold e Financiada, como os outros emails automáticos).
INSERT INTO email_templates (tipo, area, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito)
SELECT 'lembrete_faturacao', a.area, 'Lembrete · dados de faturação', 'Confirme os dados de faturação · {{curso}}',
  '["Recebemos o comprovativo do pagamento da inscrição em {{curso}}. Obrigado!", "Para emitirmos a fatura, falta confirmar os dados de faturação: nome ou empresa, NIF, morada fiscal, código postal e o email para onde enviamos a fatura.", "Já vêm preenchidos com os seus dados. Se a fatura for em nome de uma empresa, altere-os antes de confirmar."]'::jsonb,
  '<email>
  <p>Recebemos o comprovativo do pagamento da inscrição em {{curso}}. Obrigado!</p>
  <p>Para emitirmos a fatura, falta confirmar os dados de faturação: nome ou empresa, NIF, morada fiscal, código postal e o email para onde enviamos a fatura.</p>
  <p>Já vêm preenchidos com os seus dados. Se a fatura for em nome de uma empresa, altere-os antes de confirmar.</p>
  <cta ambito="contacto" href="{{link}}">Confirmar os dados de faturação</cta>
</email>
', 'Confirmar os dados de faturação', '{{link}}', 'contacto'
  FROM (VALUES ('gold'), ('fin')) AS a(area)
ON CONFLICT (tipo, area) DO NOTHING;

-- O email à contabilidade passa a levar os dados de faturação (também num modelo já editado).
UPDATE email_templates
   SET body_xml = replace(body_xml, '</email>', '  <p>Dados de faturação ({{faturacao_estado}}):<br>Nome ou empresa: {{faturacao_nome}}<br>NIF: {{faturacao_nif}}<br>Morada fiscal: {{faturacao_morada}}<br>Código postal: {{faturacao_codigo_postal}}<br>Email da fatura: {{faturacao_email}}</p>
</email>'),
       body_lines = body_lines || '["Dados de faturação ({{faturacao_estado}}):<br>Nome ou empresa: {{faturacao_nome}}<br>NIF: {{faturacao_nif}}<br>Morada fiscal: {{faturacao_morada}}<br>Código postal: {{faturacao_codigo_postal}}<br>Email da fatura: {{faturacao_email}}"]'::jsonb,
       updated_at = now()
 WHERE tipo = 'comprovativo_contabilidade' AND body_xml LIKE '%</email>%' AND body_xml NOT LIKE '%{{faturacao_nome}}%';

-- O lembrete do pagamento (sem comprovativo) lembra também os dados de faturação.
UPDATE email_templates
   SET body_xml = CASE
         WHEN body_xml LIKE '%  <cta %' THEN replace(body_xml, '  <cta ', '  <p>Depois de anexar o comprovativo, confirme também os dados de faturação na mesma página, para emitirmos a fatura.</p>
  <cta ')
         ELSE replace(body_xml, '</email>', '  <p>Depois de anexar o comprovativo, confirme também os dados de faturação na mesma página, para emitirmos a fatura.</p>
</email>') END,
       body_lines = body_lines || '["Depois de anexar o comprovativo, confirme também os dados de faturação na mesma página, para emitirmos a fatura."]'::jsonb,
       updated_at = now()
 WHERE tipo = 'lembrete_pagamento' AND body_xml LIKE '%</email>%' AND body_xml NOT LIKE '%dados de faturação%';
