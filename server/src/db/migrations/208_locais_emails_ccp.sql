-- Email de cada local (contacto no site, na confirmação da pré-inscrição e remetente do email ao formando).
-- Só onde ainda está vazio: o que já foi escrito em Edição de cursos › Locais fica.
UPDATE catalog_items SET payload = jsonb_set(payload, '{email}', to_jsonb(m.email))
  FROM (VALUES
    ('v.n.gaia', 'ccpgaia@ena.pt'), ('v.n. gaia', 'ccpgaia@ena.pt'), ('vila nova de gaia', 'ccpgaia@ena.pt'), ('gaia', 'ccpgaia@ena.pt'),
    ('lisboa', 'ccplisboa@ena.pt'), ('braga', 'ccpbraga@ena.pt'), ('aveiro', 'ccpaveiro@ena.pt'), ('leiria', 'ccpleiria@ena.pt'),
    ('valenca', 'ccpvalenca@ena.pt'), ('penafiel', 'ccppenafiel@ena.pt')
  ) AS m(nome, email)
 WHERE catalog_items.kind = 'locais'
   AND translate(lower(trim(catalog_items.payload->>'nome')), 'ç', 'c') = m.nome
   AND coalesce(trim(catalog_items.payload->>'email'), '') = '';
