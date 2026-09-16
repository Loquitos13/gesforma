CREATE TABLE IF NOT EXISTS catalog_items (
  id integer PRIMARY KEY,
  kind text NOT NULL,
  regime text NOT NULL DEFAULT 'gold',
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalog_items_kind_idx ON catalog_items (kind, regime);

CREATE TABLE IF NOT EXISTS app_settings (
  id text PRIMARY KEY,
  values jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
