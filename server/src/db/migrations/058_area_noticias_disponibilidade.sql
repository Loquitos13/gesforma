ALTER TABLE formandos_gold ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS formandos_gold_user_idx ON formandos_gold (user_id);
CREATE INDEX IF NOT EXISTS formandos_fin_user_idx ON formandos_fin (user_id);
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS corpo text NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS area_prefs jsonb NOT NULL DEFAULT '{}';
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
