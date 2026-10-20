-- Resumo (SHA-256) do conteúdo de cada ficheiro guardado: um PDF gerado igual ao que já está ligado ao dossiê não se volta a enviar ao Drive.
ALTER TABLE drive_files ADD COLUMN IF NOT EXISTS sha256 text;
