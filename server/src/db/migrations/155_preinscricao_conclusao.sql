-- Conclusão da inscrição paga (ficha, conta e email de acesso) uma de cada vez por pré-inscrição: a reentrega
-- do webhook ao mesmo tempo que a confirmação não cria duas fichas nem envia uma palavra-passe que não ficou gravada.
-- A reserva expira (10 minutos) para uma conclusão interrompida poder ser retomada.
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS conclusao_reservada_em timestamptz;
