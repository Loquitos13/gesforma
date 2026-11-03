-- Páginas livres do site (Sistema › Site): «livre-<endereço>» (ex.: livre-sobre-nos abre em /sobre-nos).
-- O título aparece na lista do editor e no separador do browser.
ALTER TABLE site_paginas ADD COLUMN IF NOT EXISTS titulo text NOT NULL DEFAULT '';
ALTER TABLE site_paginas DROP CONSTRAINT IF EXISTS site_paginas_pagina_check;
ALTER TABLE site_paginas ADD CONSTRAINT site_paginas_pagina_check
  CHECK (pagina IN ('inicio', 'moldura', 'catalogo', 'curso', 'noticias', 'noticia', 'empresas', 'servico', 'area')
         OR pagina ~ '^livre-[a-z0-9]+(-[a-z0-9]+)*$');
