-- As despesas da Financiada passam a pertencer a uma turma. As antigas ficam sem turma até alguém as associar.
ALTER TABLE despesas_fin ADD COLUMN IF NOT EXISTS turma_id integer REFERENCES turmas_fin(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS despesas_fin_turma_idx ON despesas_fin (turma_id, ordem);
