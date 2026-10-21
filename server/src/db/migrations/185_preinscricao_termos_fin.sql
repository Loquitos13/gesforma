-- Financiada: aceitação dos termos e condições e do uso dos dados (inscrição na turma e financiamento/reembolso)
-- na ligação pessoal, antes dos documentos. Prova: quando, de onde e que versão do texto foi aceite.
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS termos_fin_em timestamptz;
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS termos_fin_ip text NOT NULL DEFAULT '';
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS termos_fin_versao text NOT NULL DEFAULT '';
