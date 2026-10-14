-- Páginas do site feitas no editor visual (blocos). Cada página guarda o rascunho e a versão publicada.
CREATE TABLE IF NOT EXISTS site_paginas (
  pagina text PRIMARY KEY CHECK (pagina IN ('inicio', 'catalogo', 'area')),
  rascunho jsonb,
  publicado jsonb,
  publicado_em timestamptz,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_por uuid
);

-- O site público lê a versão publicada pela API (perfil system); só a administração escreve.
ALTER TABLE site_paginas ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_paginas FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS site_paginas_api ON site_paginas;
CREATE POLICY site_paginas_api ON site_paginas
  USING (current_setting('gesforma.api', true) = '1')
  WITH CHECK (app_role() IN ('admin', 'system'));
