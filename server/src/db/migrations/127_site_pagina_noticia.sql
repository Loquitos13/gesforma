-- Página de notícia (/noticias/<slug>) feita no editor visual.
ALTER TABLE site_paginas DROP CONSTRAINT IF EXISTS site_paginas_pagina_check;
ALTER TABLE site_paginas ADD CONSTRAINT site_paginas_pagina_check
  CHECK (pagina IN ('inicio', 'catalogo', 'curso', 'noticias', 'noticia', 'empresas', 'servico', 'area'));
