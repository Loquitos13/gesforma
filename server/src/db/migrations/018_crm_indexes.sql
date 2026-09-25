CREATE INDEX IF NOT EXISTS preinscricoes_inscrito_idx ON preinscricoes (inscrito DESC);
CREATE INDEX IF NOT EXISTS preinscricoes_proximo_idx ON preinscricoes (proximo_contacto);
CREATE INDEX IF NOT EXISTS preinscricoes_curso_idx ON preinscricoes (curso);
CREATE INDEX IF NOT EXISTS preinscricoes_local_idx ON preinscricoes (local);
