-- A secretaria pede o pagamento depois de validar os documentos: só então o passo de pagamento
-- abre na ligação pessoal. Com o pagamento confirmado criam-se a ficha de formando e a conta.
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS pagamento_pedido_em timestamptz;
