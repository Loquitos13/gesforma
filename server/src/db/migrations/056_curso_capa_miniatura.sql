ALTER TABLE curso_imagens DROP CONSTRAINT IF EXISTS curso_imagens_slot_check;

ALTER TABLE curso_imagens ADD CONSTRAINT curso_imagens_slot_check
  CHECK (slot IN ('banner', 'thumb', 'capa', 'miniatura'));

INSERT INTO curso_imagens (regime, curso_id, slot, nome, mime, bytes, token, updated_at)
SELECT regime, curso_id, 'capa', nome, mime, bytes,
       CASE WHEN token IS NULL OR token = '' THEN NULL ELSE token || 'c' END,
       updated_at
FROM curso_imagens src
WHERE slot = 'thumb'
  AND curso_id > 0
  AND NOT EXISTS (
    SELECT 1 FROM curso_imagens dst
    WHERE dst.regime = src.regime AND dst.curso_id = src.curso_id AND dst.slot = 'capa'
  );
