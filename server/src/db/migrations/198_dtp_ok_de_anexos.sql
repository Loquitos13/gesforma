-- Dossiê TP: até aqui, anexar um ficheiro a qualquer item gravava um «ok» manual, também nos itens que têm regra
-- automática (presenças, sumários, planos, pauta, certificados, documentos…). Esse «ok» mandava sobre os dados:
-- um PDF gerado sem sessões nem notas deixava o item completo. Saem os «ok» desses itens que vieram de um anexo
-- (o estado volta a sair dos dados); os «ok» postos à mão sem anexo ficam.
DELETE FROM turma_dtp t
 WHERE t.estado = 'ok'
   AND t.item_id IN (
     'cc', 'ccp-formador', 'certificados', 'ch', 'contratos-f', 'cronograma', 'cv-formador', 'cv-formando',
     'entidade-patronal', 'entrega-certificados', 'exp-formandos', 'fichas', 'habil-formador', 'iban', 'id-formador',
     'inquerito-formador', 'inquerito-formandos', 'inqueritos-pos', 'morada', 'pauta', 'pip', 'planos', 'presencas',
     'regulamento', 'rgpd-contratos', 'satisfacao', 'sim-fim', 'sim-ini', 'sumarios'
   )
   AND EXISTS (
     SELECT 1 FROM dtp_anexos a
      WHERE a.regime = t.regime AND a.turma_id = t.turma_id AND a.item_id = t.item_id
   );
