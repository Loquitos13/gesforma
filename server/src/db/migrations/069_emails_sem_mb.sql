-- Pagamento por transferência com comprovativo: os modelos de email deixam de falar em referências Multibanco.
-- Só se trocam os textos que ainda estão como vieram de origem; o XML é refeito no arranque a partir das linhas.
UPDATE email_templates
   SET nome = 'Documentos recebidos',
       assunto = 'Documentos recebidos · {{curso}}',
       body_lines = '["Recebemos os documentos de {{curso}}.", "A secretaria valida-os e, depois, envia-lhe os dados para pagamento por transferência bancária.", "Quando pagar, anexe o comprovativo na mesma ligação pessoal."]'::jsonb,
       body_xml = '',
       updated_at = now()
 WHERE tipo = 'pagamento_ref'
   AND (body_lines::text ILIKE '%multibanco%' OR COALESCE(body_xml, '') ILIKE '%multibanco%' OR assunto ILIKE '%{{referencia}}%');

UPDATE email_templates
   SET body_lines = '["Há três dias que a pré-inscrição em {{curso}} está sem pagamento.", "Se ainda quiser a vaga, responda a este email ou ligue para a secretaria. Reenviamos os dados para transferência."]'::jsonb,
       body_xml = '',
       updated_at = now()
 WHERE tipo = 'unpaid_3d'
   AND (body_lines::text ILIKE '%multibanco%' OR COALESCE(body_xml, '') ILIKE '%multibanco%');

UPDATE email_rules
   SET nome = 'Documentos recebidos'
 WHERE trigger_key = 'preinscricao.docs_completos' AND nome = 'Referência após documentos';
