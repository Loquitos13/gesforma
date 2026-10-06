ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS valores_hora_formador jsonb NOT NULL DEFAULT '{}';
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS valores_hora_formador jsonb NOT NULL DEFAULT '{}';

ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

ALTER TABLE comercial_objetivos ADD COLUMN IF NOT EXISTS meta_leads integer NOT NULL DEFAULT 0;
ALTER TABLE comercial_objetivos ADD COLUMN IF NOT EXISTS meta_propostas integer NOT NULL DEFAULT 0;
ALTER TABLE comercial_objetivos ADD COLUMN IF NOT EXISTS telefone text NOT NULL DEFAULT '';
ALTER TABLE comercial_objetivos ADD COLUMN IF NOT EXISTS nota text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION app_role() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT COALESCE(NULLIF(current_setting('app.role', true), ''), 'system') $$;

CREATE OR REPLACE FUNCTION app_user_id() RETURNS text
LANGUAGE sql STABLE AS $$ SELECT COALESCE(current_setting('app.user_id', true), '') $$;

ALTER TABLE preinscricoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE preinscricoes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON preinscricoes;
DROP POLICY IF EXISTS preinscricoes_isolamento ON preinscricoes;
CREATE POLICY preinscricoes_isolamento ON preinscricoes
  USING (
    app_role() IN ('admin', 'secretaria', 'system')
    OR (app_role() = 'financiada' AND regime = 'fin')
    OR (app_role() = 'comercial' AND comercial_id::text = app_user_id())
  )
  WITH CHECK (
    app_role() IN ('admin', 'secretaria', 'system')
    OR (app_role() = 'financiada' AND regime = 'fin')
    OR (app_role() = 'comercial' AND comercial_id::text = app_user_id())
  );

ALTER TABLE propostas_comerciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE propostas_comerciais FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS propostas_isolamento ON propostas_comerciais;
CREATE POLICY propostas_isolamento ON propostas_comerciais
  USING (
    app_role() IN ('admin', 'secretaria', 'system')
    OR (app_role() = 'financiada' AND regime = 'fin')
    OR (app_role() = 'comercial' AND comercial_id::text = app_user_id())
  )
  WITH CHECK (
    app_role() IN ('admin', 'secretaria', 'system')
    OR (app_role() = 'financiada' AND regime = 'fin')
    OR (app_role() = 'comercial' AND comercial_id::text = app_user_id())
  );

ALTER TABLE contratos_comerciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE contratos_comerciais FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contratos_isolamento ON contratos_comerciais;
CREATE POLICY contratos_isolamento ON contratos_comerciais
  USING (
    app_role() IN ('admin', 'secretaria', 'system')
    OR (app_role() = 'comercial' AND comercial_id::text = app_user_id())
  )
  WITH CHECK (
    app_role() IN ('admin', 'secretaria', 'system')
    OR (app_role() = 'comercial' AND comercial_id::text = app_user_id())
  );

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON users;
DROP POLICY IF EXISTS users_isolamento ON users;
CREATE POLICY users_isolamento ON users
  USING (
    app_role() IN ('admin', 'secretaria', 'system')
    OR id::text = app_user_id()
  )
  WITH CHECK (
    app_role() IN ('admin', 'secretaria', 'system')
    OR id::text = app_user_id()
  );

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON sessions;
DROP POLICY IF EXISTS sessions_isolamento ON sessions;
CREATE POLICY sessions_isolamento ON sessions
  USING (
    app_role() IN ('admin', 'system')
    OR user_id::text = app_user_id()
  )
  WITH CHECK (
    app_role() IN ('admin', 'system')
    OR user_id::text = app_user_id()
  );

ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON pagamentos;
DROP POLICY IF EXISTS pagamentos_isolamento ON pagamentos;
CREATE POLICY pagamentos_isolamento ON pagamentos
  USING (app_role() IN ('admin', 'secretaria', 'financiada', 'system'))
  WITH CHECK (app_role() IN ('admin', 'secretaria', 'financiada', 'system'));

ALTER TABLE formandos_gold ENABLE ROW LEVEL SECURITY;
ALTER TABLE formandos_gold FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON formandos_gold;
DROP POLICY IF EXISTS formandos_gold_isolamento ON formandos_gold;
CREATE POLICY formandos_gold_isolamento ON formandos_gold
  USING (app_role() IN ('admin', 'secretaria', 'formador', 'system'))
  WITH CHECK (app_role() IN ('admin', 'secretaria', 'formador', 'system'));

ALTER TABLE formandos_fin ENABLE ROW LEVEL SECURITY;
ALTER TABLE formandos_fin FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON formandos_fin;
DROP POLICY IF EXISTS formandos_fin_isolamento ON formandos_fin;
CREATE POLICY formandos_fin_isolamento ON formandos_fin
  USING (app_role() IN ('admin', 'secretaria', 'financiada', 'formador', 'system'))
  WITH CHECK (app_role() IN ('admin', 'secretaria', 'financiada', 'formador', 'system'));

ALTER TABLE lead_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_eventos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lead_eventos_isolamento ON lead_eventos;
CREATE POLICY lead_eventos_isolamento ON lead_eventos
  USING (
    app_role() IN ('admin', 'secretaria', 'system')
    OR (
      app_role() = 'comercial'
      AND EXISTS (
        SELECT 1 FROM preinscricoes p
         WHERE p.id = lead_eventos.lead_id
           AND p.comercial_id::text = app_user_id()
      )
    )
  )
  WITH CHECK (
    app_role() IN ('admin', 'secretaria', 'system')
    OR (
      app_role() = 'comercial'
      AND EXISTS (
        SELECT 1 FROM preinscricoes p
         WHERE p.id = lead_eventos.lead_id
           AND p.comercial_id::text = app_user_id()
      )
    )
  );
