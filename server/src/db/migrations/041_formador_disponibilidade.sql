ALTER TABLE formadores ADD COLUMN IF NOT EXISTS disponibilidade jsonb NOT NULL DEFAULT '[]';
