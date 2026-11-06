-- Quando os documentos obrigatórios do curso ficaram todos validados (na ligação pessoal ou entregues pela equipa):
-- a partir daí a pré-inscrição Gold paga aguarda o pagamento e a equipa pode entregar o comprovativo, sem ter de o
-- pedir. `docs_verificados` marca as pré-inscrições já vistas (as antigas são calculadas aos poucos, em segundo plano).
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS docs_validados_em timestamptz;
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS docs_verificados boolean NOT NULL DEFAULT false;
