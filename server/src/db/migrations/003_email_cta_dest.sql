ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS cta_href text NOT NULL DEFAULT '';
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS cta_ambito text NOT NULL DEFAULT 'plataforma';
