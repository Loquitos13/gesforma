-- Documentos do dossiê do formando que vieram da ligação pessoal da pré-inscrição.
-- Saem da área do formando se ele deixar de ser formando de uma turma desse curso.
ALTER TABLE formando_docs ADD COLUMN IF NOT EXISTS origem_preinscricao_id integer;
CREATE INDEX IF NOT EXISTS formando_docs_origem_idx ON formando_docs (origem_preinscricao_id) WHERE origem_preinscricao_id IS NOT NULL;

-- Antes, cada upload da ligação pessoal ficava «ok» no dossiê de qualquer formando com o mesmo email,
-- sem validação. Esses registos (ficheiro da pré-inscrição, sem quem validou) voltam a pendente.
UPDATE formando_docs SET ok = false, estado = 'pendente'
 WHERE validated_by IS NULL
   AND COALESCE(estado, 'pendente') <> 'validado'
   AND drive_file_id <> ''
   AND drive_file_id IN (SELECT drive_file_id FROM preinscricao_docs WHERE drive_file_id <> '');
