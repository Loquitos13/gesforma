-- Escolaridade pedida no formulário de pré-inscrição Gold: decide os documentos do CCP (12.º ano: comprovativo de 5 anos de experiência).
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS escolaridade text NOT NULL DEFAULT '';
