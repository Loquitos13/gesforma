ALTER TABLE catalog_items DROP CONSTRAINT IF EXISTS catalog_items_pkey;
ALTER TABLE catalog_items ADD PRIMARY KEY (kind, id);
