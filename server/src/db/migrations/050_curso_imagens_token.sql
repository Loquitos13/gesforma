ALTER TABLE curso_imagens ADD COLUMN IF NOT EXISTS token text;

UPDATE curso_imagens
SET token = md5(random()::text || clock_timestamp()::text || slot)
WHERE token IS NULL OR btrim(token) = '';

CREATE UNIQUE INDEX IF NOT EXISTS curso_imagens_token_key ON curso_imagens (token);
