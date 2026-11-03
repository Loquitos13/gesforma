-- Emails por área: a coordenação Gold, a coordenação Financiada e a contabilidade têm os seus modelos e regras
-- (cada uma edita e acrescenta os seus; a administração vê todos, com a área). Os emails automáticos que já existiam
-- ficam na Gold e ganham uma cópia igual na Financiada; o email do comprovativo para a contabilidade passa para a área
-- da Contabilidade.
ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS area text NOT NULL DEFAULT 'gold';
ALTER TABLE email_rules ADD COLUMN IF NOT EXISTS area text NOT NULL DEFAULT 'gold';
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_area_check;
ALTER TABLE email_templates ADD CONSTRAINT email_templates_area_check CHECK (area IN ('gold', 'fin', 'contabilidade'));
ALTER TABLE email_rules DROP CONSTRAINT IF EXISTS email_rules_area_check;
ALTER TABLE email_rules ADD CONSTRAINT email_rules_area_check CHECK (area IN ('gold', 'fin', 'contabilidade'));

-- O tipo deixa de ser único sozinho: passa a ser único por área (e a regra aponta para o modelo da sua área).
ALTER TABLE email_rules DROP CONSTRAINT IF EXISTS email_rules_template_tipo_fkey;
ALTER TABLE email_rules DROP CONSTRAINT IF EXISTS email_rules_template_area_fkey;
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_tipo_key;
ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_tipo_area_key;
ALTER TABLE email_templates ADD CONSTRAINT email_templates_tipo_area_key UNIQUE (tipo, area);

UPDATE email_templates SET area = 'contabilidade' WHERE tipo = 'comprovativo_contabilidade';
UPDATE email_rules SET area = 'contabilidade' WHERE template_tipo = 'comprovativo_contabilidade';

INSERT INTO email_templates (tipo, area, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito)
SELECT tipo, 'fin', nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito
  FROM email_templates WHERE area = 'gold'
ON CONFLICT (tipo, area) DO NOTHING;

INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, curso, ativo, dias, area)
SELECT nome, trigger_key, gatilho_label, template_tipo, delay_seconds, curso, ativo, dias, 'fin'
  FROM email_rules WHERE area = 'gold';

ALTER TABLE email_rules ADD CONSTRAINT email_rules_template_area_fkey
  FOREIGN KEY (template_tipo, area) REFERENCES email_templates (tipo, area) ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS email_rules_area_idx ON email_rules (area, trigger_key, ativo);
