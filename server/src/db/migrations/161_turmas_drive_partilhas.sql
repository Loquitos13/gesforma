-- Última sincronização das partilhas da pasta da turma na Drive. Vazio = ainda com as partilhas antigas
-- (formandos como editores da pasta inteira): o cron /v1/cron/drive acerta-as aos poucos.
ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS drive_partilhas_em timestamptz;
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS drive_partilhas_em timestamptz;
