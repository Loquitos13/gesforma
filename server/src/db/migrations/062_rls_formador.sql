-- O formador lê os formandos (a API recorta às suas turmas), mas nunca os altera
-- nem lê os documentos pessoais do dossiê.
DROP POLICY IF EXISTS formandos_gold_isolamento ON formandos_gold;
CREATE POLICY formandos_gold_isolamento ON formandos_gold
  USING (
    app_role() IN ('admin', 'secretaria', 'formador', 'system')
    OR (app_role() = 'formando' AND user_id IS NOT NULL AND user_id::text = app_user_id())
  )
  WITH CHECK (
    app_role() IN ('admin', 'secretaria', 'system')
    OR (app_role() = 'formando' AND user_id IS NOT NULL AND user_id::text = app_user_id())
  );

DROP POLICY IF EXISTS formandos_fin_isolamento ON formandos_fin;
CREATE POLICY formandos_fin_isolamento ON formandos_fin
  USING (
    app_role() IN ('admin', 'secretaria', 'financiada', 'formador', 'system')
    OR (app_role() = 'formando' AND user_id IS NOT NULL AND user_id::text = app_user_id())
  )
  WITH CHECK (
    app_role() IN ('admin', 'secretaria', 'financiada', 'system')
    OR (app_role() = 'formando' AND user_id IS NOT NULL AND user_id::text = app_user_id())
  );

DROP POLICY IF EXISTS formando_docs_isolamento ON formando_docs;
CREATE POLICY formando_docs_isolamento ON formando_docs
  USING (
    app_role() IN ('admin', 'secretaria', 'financiada', 'system')
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
    app_role() IN ('admin', 'secretaria', 'financiada', 'system')
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
