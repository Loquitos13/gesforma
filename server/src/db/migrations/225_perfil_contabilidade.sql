-- Perfil «Contabilidade»: pagamentos (comprovativos, dados de faturação, recibos e faturas) e os seus emails.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'secretaria', 'comercial', 'financiada', 'contabilidade', 'formador', 'formando'));

-- RLS (quando a base o aplica; a API em produção liga-se como superutilizador). A contabilidade lê e escreve os
-- pagamentos e os dados de faturação e vê as pré-inscrições da Gold de quem paga; a coordenação Gold deixa de ver as
-- da Financiada (cada coordenação só na sua linha).
DROP POLICY IF EXISTS pagamentos_isolamento ON pagamentos;
CREATE POLICY pagamentos_isolamento ON pagamentos
  USING (app_role() IN ('admin', 'secretaria', 'financiada', 'contabilidade', 'system'))
  WITH CHECK (app_role() IN ('admin', 'secretaria', 'financiada', 'contabilidade', 'system'));

DROP POLICY IF EXISTS preinscricao_faturacao_equipa ON preinscricao_faturacao;
CREATE POLICY preinscricao_faturacao_equipa ON preinscricao_faturacao
  USING (current_setting('gesforma.api', true) = '1' AND app_role() IN ('admin', 'secretaria', 'financiada', 'contabilidade', 'system'))
  WITH CHECK (current_setting('gesforma.api', true) = '1' AND app_role() IN ('admin', 'secretaria', 'financiada', 'contabilidade', 'system'));

DROP POLICY IF EXISTS preinscricoes_isolamento ON preinscricoes;
CREATE POLICY preinscricoes_isolamento ON preinscricoes
  USING (
    app_role() IN ('admin', 'system')
    OR (app_role() IN ('secretaria', 'contabilidade') AND regime IS DISTINCT FROM 'fin')
    OR (app_role() = 'financiada' AND regime = 'fin')
    OR (app_role() = 'comercial' AND comercial_id::text = app_user_id())
  )
  WITH CHECK (
    app_role() IN ('admin', 'system')
    OR (app_role() IN ('secretaria', 'contabilidade') AND regime IS DISTINCT FROM 'fin')
    OR (app_role() = 'financiada' AND regime = 'fin')
    OR (app_role() = 'comercial' AND comercial_id::text = app_user_id())
  );
