ALTER TABLE preinscricoes
  ADD COLUMN IF NOT EXISTS nif text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS morada_fiscal text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS codigo_postal text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS motivo_desistencia text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS pagamento_metodo text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS secretaria_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_nota text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ultima_actividade_em timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_resultado text NOT NULL DEFAULT '';

ALTER TABLE preinscricao_contactos
  ADD COLUMN IF NOT EXISTS resultado text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fixada boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS preinscricoes_secretaria_idx ON preinscricoes (secretaria_em) WHERE secretaria_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS preinscricoes_comercial_idx ON preinscricoes (comercial_id);
CREATE INDEX IF NOT EXISTS preinscricao_contactos_fixada_idx ON preinscricao_contactos (preinscricao_id) WHERE fixada = true;
