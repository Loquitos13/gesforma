-- Turma cujo preço foi pedido no pagamento: a inscrição paga só conclui nessa turma (ou noutra que a secretaria escolha).
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS pagamento_turma_id integer;
UPDATE preinscricoes SET pagamento_turma_id = turma_escolhida_id
  WHERE pagamento_pedido_em IS NOT NULL AND pagamento_turma_id IS NULL AND turma_escolhida_id IS NOT NULL;
