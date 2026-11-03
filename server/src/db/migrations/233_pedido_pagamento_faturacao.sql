-- O pedido de pagamento explica o passo seguinte da página: depois do comprovativo, confirmar os dados de faturação
-- (também num modelo já editado, se ainda não fala deles).
UPDATE email_templates
   SET body_xml = CASE
         WHEN body_xml LIKE '%  <cta %' THEN replace(body_xml, '  <cta ', '  <p>Depois de anexar o comprovativo, a mesma página pede os dados de faturação: já vêm com os seus dados; se a fatura for em nome de uma empresa, altere-os antes de confirmar.</p>
  <cta ')
         ELSE replace(body_xml, '</email>', '  <p>Depois de anexar o comprovativo, a mesma página pede os dados de faturação: já vêm com os seus dados; se a fatura for em nome de uma empresa, altere-os antes de confirmar.</p>
</email>') END,
       body_lines = body_lines || '["Depois de anexar o comprovativo, a mesma página pede os dados de faturação: já vêm com os seus dados; se a fatura for em nome de uma empresa, altere-os antes de confirmar."]'::jsonb,
       updated_at = now()
 WHERE tipo = 'pedido_pagamento' AND body_xml LIKE '%</email>%' AND body_xml NOT LIKE '%dados de faturação%';
