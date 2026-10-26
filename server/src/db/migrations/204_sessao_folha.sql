-- Folha de presenças da sessão: componente teórica e prática (horas T / P, definidas pelo formador)
-- e quem validou as presenças (a validação continua em sumario.presencasValidadas).
ALTER TABLE turma_sessoes ADD COLUMN IF NOT EXISTS folha jsonb;
