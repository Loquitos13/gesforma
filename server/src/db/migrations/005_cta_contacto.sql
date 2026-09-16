UPDATE email_templates
SET cta_ambito = 'contacto'
WHERE cta_ambito = 'plataforma';

ALTER TABLE email_templates ALTER COLUMN cta_ambito SET DEFAULT 'contacto';
