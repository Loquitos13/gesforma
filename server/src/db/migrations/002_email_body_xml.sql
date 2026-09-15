ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS body_xml text NOT NULL DEFAULT '';
