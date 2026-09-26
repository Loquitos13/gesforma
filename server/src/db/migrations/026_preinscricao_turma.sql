ALTER TABLE preinscricoes
  ADD COLUMN IF NOT EXISTS horario text NOT NULL DEFAULT '';
ALTER TABLE preinscricoes
  ADD COLUMN IF NOT EXISTS turma_id integer;
