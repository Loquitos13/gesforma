ALTER TABLE preinscricoes
  ADD COLUMN IF NOT EXISTS lembrete_pre_em timestamptz,
  ADD COLUMN IF NOT EXISTS turmas_recusadas integer[] NOT NULL DEFAULT '{}';

UPDATE preinscricoes SET lembrete_pre_em = now() WHERE lembrete_pre_em IS NULL;

INSERT INTO app_settings (id, values)
VALUES ('lembrete_pre', '{"activo":"1","quantidade":"1","unidade":"dias"}'::jsonb)
ON CONFLICT (id) DO NOTHING;
