-- O comercial vê (e trabalha) todas as pré-inscrições da Gold: as sem comercial atribuído e as de outro comercial.
-- As da Financiada continuam fora. Propostas e contratos ficam como estavam (só os seus).
DROP POLICY IF EXISTS preinscricoes_isolamento ON preinscricoes;
CREATE POLICY preinscricoes_isolamento ON preinscricoes
  USING (
    app_role() IN ('admin', 'system')
    OR (app_role() IN ('secretaria', 'contabilidade', 'comercial') AND regime IS DISTINCT FROM 'fin')
    OR (app_role() = 'financiada' AND regime = 'fin')
  )
  WITH CHECK (
    app_role() IN ('admin', 'system')
    OR (app_role() IN ('secretaria', 'contabilidade', 'comercial') AND regime IS DISTINCT FROM 'fin')
    OR (app_role() = 'financiada' AND regime = 'fin')
  );

-- O histórico (actividade) das pré-inscrições: o comercial vê o de todas as da Gold.
DROP POLICY IF EXISTS lead_eventos_isolamento ON lead_eventos;
CREATE POLICY lead_eventos_isolamento ON lead_eventos
  USING (
    app_role() IN ('admin', 'secretaria', 'system')
    OR (app_role() = 'comercial' AND EXISTS (
      SELECT 1 FROM preinscricoes p WHERE p.id = lead_eventos.lead_id AND p.regime IS DISTINCT FROM 'fin'))
  )
  WITH CHECK (
    app_role() IN ('admin', 'secretaria', 'system')
    OR (app_role() = 'comercial' AND EXISTS (
      SELECT 1 FROM preinscricoes p WHERE p.id = lead_eventos.lead_id AND p.regime IS DISTINCT FROM 'fin'))
  );
