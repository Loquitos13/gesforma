ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON users;
CREATE POLICY gesforma_api ON users FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON sessions;
CREATE POLICY gesforma_api ON sessions FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE email_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_jobs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON email_jobs;
CREATE POLICY gesforma_api ON email_jobs FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON audit_log;
CREATE POLICY gesforma_api ON audit_log FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE preinscricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE preinscricoes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON preinscricoes;
CREATE POLICY gesforma_api ON preinscricoes FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE preinscricao_contactos ENABLE ROW LEVEL SECURITY;
ALTER TABLE preinscricao_contactos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON preinscricao_contactos;
CREATE POLICY gesforma_api ON preinscricao_contactos FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE preinscricao_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE preinscricao_docs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON preinscricao_docs;
CREATE POLICY gesforma_api ON preinscricao_docs FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE formandos_gold ENABLE ROW LEVEL SECURITY;
ALTER TABLE formandos_gold FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON formandos_gold;
CREATE POLICY gesforma_api ON formandos_gold FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE formandos_fin ENABLE ROW LEVEL SECURITY;
ALTER TABLE formandos_fin FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON formandos_fin;
CREATE POLICY gesforma_api ON formandos_fin FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS turma_id integer;

UPDATE formandos_fin f
SET turma_id = t.id
FROM turmas_fin t
WHERE f.turma_id IS NULL
  AND lower(trim(f.turma)) = lower(trim(t.nome));

ALTER TABLE formadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE formadores FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON formadores;
CREATE POLICY gesforma_api ON formadores FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE formando_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE formando_docs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON formando_docs;
CREATE POLICY gesforma_api ON formando_docs FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE formador_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE formador_docs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON formador_docs;
CREATE POLICY gesforma_api ON formador_docs FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON pagamentos;
CREATE POLICY gesforma_api ON pagamentos FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE doc_alertas ENABLE ROW LEVEL SECURITY;
ALTER TABLE doc_alertas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON doc_alertas;
CREATE POLICY gesforma_api ON doc_alertas FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE smtp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE smtp_config FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON smtp_config;
CREATE POLICY gesforma_api ON smtp_config FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE drive_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE drive_config FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON drive_config;
CREATE POLICY gesforma_api ON drive_config FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE whatsapp_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_config FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON whatsapp_config;
CREATE POLICY gesforma_api ON whatsapp_config FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE whatsapp_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_mensagens FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON whatsapp_mensagens;
CREATE POLICY gesforma_api ON whatsapp_mensagens FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');
