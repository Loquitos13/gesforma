-- Pagamentos: recusa do comprovativo, quem confirmou e data de criação.
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS recusado_em timestamptz;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS recusa_motivo text NOT NULL DEFAULT '';
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS confirmado_por uuid;
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- A data antiga (texto "aaaa-mm-dd hh:mm" ou "dd/mm/aaaa") passa a ser a data de criação dos registos que já existem.
UPDATE pagamentos
   SET created_at = to_timestamp(substring(data from '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}'), 'YYYY-MM-DD HH24:MI')
 WHERE data ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}';
UPDATE pagamentos
   SET created_at = (substring(data from '^\d{4}-\d{2}-\d{2}'))::date
 WHERE data ~ '^\d{4}-\d{2}-\d{2}($|[^ ])';
UPDATE pagamentos
   SET created_at = to_date(substring(data from '^\d{2}/\d{2}/\d{4}'), 'DD/MM/YYYY')
 WHERE data ~ '^\d{2}/\d{2}/\d{4}';

CREATE INDEX IF NOT EXISTS pagamentos_created_idx ON pagamentos (created_at DESC);

-- Histórico de envios: listar por regra e por estado.
CREATE INDEX IF NOT EXISTS email_jobs_rule_sent_idx ON email_jobs (rule_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS email_jobs_status_idx ON email_jobs (status, scheduled_at);

-- Auditoria: filtros por data, utilizador e entidade.
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx ON audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity, entity_id);
