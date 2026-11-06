-- Pagamento em prestações (Gold): os valores confirmados pela equipa ao anexar o primeiro comprovativo. O 1.º comprovativo
-- é o «comprovativo» de sempre (confirma o pagamento e deixa inserir na turma); os seguintes são «comprovativo-2», ….
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS prestacoes jsonb;
