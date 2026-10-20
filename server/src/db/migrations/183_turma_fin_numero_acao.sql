-- Número da ação da turma da Financiada («UFCD 8995 - … / Ação 1» na coluna E «Curso/Ação» da execução física).
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS numero_acao integer NOT NULL DEFAULT 1 CHECK (numero_acao >= 1);
