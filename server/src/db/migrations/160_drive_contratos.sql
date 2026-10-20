-- PDFs de contratos assinados na Drive: a linha guarda o contrato a que pertence, para valer a mesma regra
-- de visibilidade do contrato (admin e secretaria; o comercial só os seus; a Financiada os dos formandos
-- financiados). Sem chave estrangeira: um contrato apagado deixa o PDF visível só a admin e secretaria.
ALTER TABLE drive_files ADD COLUMN IF NOT EXISTS contrato_id integer;
CREATE INDEX IF NOT EXISTS drive_files_contrato_idx ON drive_files (contrato_id) WHERE contrato_id IS NOT NULL;

-- Os já guardados: pelo pedido de assinatura que aponta para o ficheiro.
UPDATE drive_files f
   SET contrato_id = a.contrato_id,
       regime = COALESCE(f.regime, k.formando_regime)
  FROM contrato_assinaturas a
  JOIN contratos_comerciais k ON k.id = a.contrato_id
 WHERE a.drive_file_id = f.id AND f.contrato_id IS NULL;

-- Sem pedido ligado: pelo nome que guardarNaDrive dá ao PDF («Contrato <id> - <nome> - assinado.pdf»).
UPDATE drive_files f
   SET contrato_id = k.id,
       regime = COALESCE(f.regime, k.formando_regime)
  FROM contratos_comerciais k
 WHERE f.contrato_id IS NULL
   AND f.kind IN ('contrato', 'formando-doc')
   AND f.name ~ '^Contrato [0-9]+ - .* - assinado\.pdf$'
   AND k.id = substring(f.name from '^Contrato ([0-9]+) - ')::int;
