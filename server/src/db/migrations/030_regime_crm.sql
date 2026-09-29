ALTER TABLE preinscricoes
  ADD COLUMN IF NOT EXISTS regime text NOT NULL DEFAULT 'gold';

UPDATE preinscricoes p
   SET regime = 'fin'
 WHERE EXISTS (
   SELECT 1 FROM cursos_fin c
    WHERE lower(trim(c.nome_comercial)) = lower(trim(p.curso))
       OR lower(trim(c.ufcd)) = lower(trim(p.curso))
 );

ALTER TABLE preinscricoes DROP CONSTRAINT IF EXISTS preinscricoes_regime_check;

ALTER TABLE preinscricoes
  ADD CONSTRAINT preinscricoes_regime_check CHECK (regime IN ('gold', 'fin'));

CREATE INDEX IF NOT EXISTS preinscricoes_regime_idx ON preinscricoes (regime, estado);

ALTER TABLE propostas_comerciais
  ADD COLUMN IF NOT EXISTS regime text NOT NULL DEFAULT 'gold';

ALTER TABLE propostas_comerciais DROP CONSTRAINT IF EXISTS propostas_regime_check;

ALTER TABLE propostas_comerciais
  ADD CONSTRAINT propostas_regime_check CHECK (regime IN ('gold', 'fin'));
