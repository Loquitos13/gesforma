-- O editor visual passa a ter a página de curso (a mesma para todos os cursos).
ALTER TABLE site_paginas DROP CONSTRAINT IF EXISTS site_paginas_pagina_check;
ALTER TABLE site_paginas ADD CONSTRAINT site_paginas_pagina_check
  CHECK (pagina IN ('inicio', 'catalogo', 'curso', 'noticias', 'empresas', 'area'));
