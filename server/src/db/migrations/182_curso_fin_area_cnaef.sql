-- Área de formação CNAEF do curso da Financiada («341 - Comércio»), um valor da lista do template de
-- execução física (coluna D «Área de Formação»).
ALTER TABLE cursos_fin ADD COLUMN IF NOT EXISTS area_cnaef text NOT NULL DEFAULT '';
