-- Registo manual de pagamentos: a chave enviada pelo ecrã (uma por formulário aberto) torna o pedido idempotente.
-- Um duplo clique ou um reenvio devolve o pagamento já criado em vez de registar outro.
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS chave_idempotencia text;
CREATE UNIQUE INDEX IF NOT EXISTS pagamentos_chave_idempotencia_idx ON pagamentos (chave_idempotencia) WHERE chave_idempotencia IS NOT NULL;
