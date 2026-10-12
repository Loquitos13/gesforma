ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS pii_enc text NOT NULL DEFAULT '';
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS public_id text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS preinscricoes_public_id_uq ON preinscricoes (public_id) WHERE public_id <> '';

ALTER TABLE formandos_gold ADD COLUMN IF NOT EXISTS pii_enc text NOT NULL DEFAULT '';
ALTER TABLE formandos_gold ADD COLUMN IF NOT EXISTS docs_enc text NOT NULL DEFAULT '';
ALTER TABLE formandos_gold ADD COLUMN IF NOT EXISTS public_id text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS formandos_gold_public_id_uq ON formandos_gold (public_id) WHERE public_id <> '';

ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS pii_enc text NOT NULL DEFAULT '';
ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS docs_enc text NOT NULL DEFAULT '';
ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS public_id text NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS formandos_fin_public_id_uq ON formandos_fin (public_id) WHERE public_id <> '';

DROP POLICY IF EXISTS formandos_gold_isolamento ON formandos_gold;
CREATE POLICY formandos_gold_isolamento ON formandos_gold
  USING (
    app_role() IN ('admin', 'secretaria', 'formador', 'system')
    OR (app_role() = 'formando' AND user_id IS NOT NULL AND user_id::text = app_user_id())
  )
  WITH CHECK (
    app_role() IN ('admin', 'secretaria', 'formador', 'system')
    OR (app_role() = 'formando' AND user_id IS NOT NULL AND user_id::text = app_user_id())
  );

DROP POLICY IF EXISTS formandos_fin_isolamento ON formandos_fin;
CREATE POLICY formandos_fin_isolamento ON formandos_fin
  USING (
    app_role() IN ('admin', 'secretaria', 'financiada', 'formador', 'system')
    OR (app_role() = 'formando' AND user_id IS NOT NULL AND user_id::text = app_user_id())
  )
  WITH CHECK (
    app_role() IN ('admin', 'secretaria', 'financiada', 'formador', 'system')
    OR (app_role() = 'formando' AND user_id IS NOT NULL AND user_id::text = app_user_id())
  );

DROP POLICY IF EXISTS formando_docs_isolamento ON formando_docs;
CREATE POLICY formando_docs_isolamento ON formando_docs
  USING (
    app_role() IN ('admin', 'secretaria', 'financiada', 'formador', 'system')
    OR (
      app_role() = 'formando'
      AND (
        (regime = 'gold' AND EXISTS (
          SELECT 1 FROM formandos_gold g WHERE g.id = formando_docs.formando_id AND g.user_id::text = app_user_id()
        ))
        OR (regime = 'fin' AND EXISTS (
          SELECT 1 FROM formandos_fin f WHERE f.id = formando_docs.formando_id AND f.user_id::text = app_user_id()
        ))
      )
    )
  )
  WITH CHECK (
    app_role() IN ('admin', 'secretaria', 'financiada', 'formador', 'system')
    OR (
      app_role() = 'formando'
      AND (
        (regime = 'gold' AND EXISTS (
          SELECT 1 FROM formandos_gold g WHERE g.id = formando_docs.formando_id AND g.user_id::text = app_user_id()
        ))
        OR (regime = 'fin' AND EXISTS (
          SELECT 1 FROM formandos_fin f WHERE f.id = formando_docs.formando_id AND f.user_id::text = app_user_id()
        ))
      )
    )
  );

CREATE TABLE IF NOT EXISTS login_rate (
  ip text NOT NULL,
  email_hash text NOT NULL DEFAULT '',
  attempts int NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz,
  PRIMARY KEY (ip, email_hash)
);

ALTER TABLE login_rate ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_rate FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS login_rate_api ON login_rate;
CREATE POLICY login_rate_api ON login_rate
  FOR ALL USING (app_role() = 'system') WITH CHECK (app_role() = 'system');
