-- O editor visual passa a ter todas as páginas do site: notícias e empresas juntam-se às outras.
ALTER TABLE site_paginas DROP CONSTRAINT IF EXISTS site_paginas_pagina_check;
ALTER TABLE site_paginas ADD CONSTRAINT site_paginas_pagina_check
  CHECK (pagina IN ('inicio', 'catalogo', 'noticias', 'empresas', 'area'));
