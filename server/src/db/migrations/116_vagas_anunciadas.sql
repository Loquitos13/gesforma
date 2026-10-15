-- Vagas que o site anuncia (para criar urgência), editáveis pelo comercial. Vazio = as vagas reais.
-- O site nunca mostra mais do que as vagas reais e a reserva de vaga continua a usar as reais.
ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS vagas_anunciadas integer CHECK (vagas_anunciadas IS NULL OR vagas_anunciadas >= 0);
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS vagas_anunciadas integer CHECK (vagas_anunciadas IS NULL OR vagas_anunciadas >= 0);
