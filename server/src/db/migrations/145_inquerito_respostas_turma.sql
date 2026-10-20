-- A resposta ao inquérito fica associada à turma da ligação enviada (?turma=<id>). O regime é o do inquérito,
-- por isso não há chave estrangeira (a turma pode ser Gold ou Financiada). As antigas ficam sem turma_id e
-- continuam a ser cruzadas pelo nome escrito.
ALTER TABLE inquerito_respostas ADD COLUMN IF NOT EXISTS turma_id integer;
CREATE INDEX IF NOT EXISTS inquerito_respostas_turma_idx ON inquerito_respostas (inquerito_id, turma_id);
