ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS oauth_redirect_uri text;
