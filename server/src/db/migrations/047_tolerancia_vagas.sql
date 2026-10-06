ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS tolerancia_vagas integer NOT NULL DEFAULT 0;
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS tolerancia_vagas integer NOT NULL DEFAULT 0;
