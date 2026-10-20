-- Despesas automáticas da Financiada: uma por formador da turma (horas no cronograma × valor por hora da visão
-- geral, ou o custo por hora da ficha). `origem` = 'formador' nessas linhas; `formador` é o nome (a chave);
-- `aviso` explica uma linha que já não acompanha a turma (o formador saiu, ficou sem horas ou sem valor) e que
-- se mantém porque a equipa já lhe preencheu campos.
ALTER TABLE despesas_fin ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'formador'));
ALTER TABLE despesas_fin ADD COLUMN IF NOT EXISTS formador text;
ALTER TABLE despesas_fin ADD COLUMN IF NOT EXISTS aviso text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS despesas_fin_formador_uq ON despesas_fin (turma_id, lower(formador)) WHERE origem = 'formador';
