ALTER TABLE email_jobs ADD COLUMN IF NOT EXISTS opened_at timestamptz;
ALTER TABLE campanhas ADD COLUMN IF NOT EXISTS curso text;
