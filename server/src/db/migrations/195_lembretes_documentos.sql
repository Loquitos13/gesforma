-- Notificações dos documentos em falta ou recusados (pré-inscrições e formandos da Financiada).
-- · Documento recusado: a pessoa recebe logo um email («documento_recusado») com o motivo e a ligação pessoal.
--   recusa_avisada_em marca cada recusa já avisada; recusa_email_em é o último email desse tipo (agrupa recusas seguidas).
-- · lembrete_enviado_em: o último lembrete automático que saiu (lembrete_pre_em também anda quando o lembrete é adiado).
-- · Formandos da Financiada: lembretes automáticos dos documentos do dossiê, na mesma cadência das pré-inscrições.
--   Só entram no ciclo depois de um lembrete manual ou de uma recusa (lembrete_docs_em NULL = fora do ciclo).

ALTER TABLE preinscricao_docs ADD COLUMN IF NOT EXISTS recusa_avisada_em timestamptz;
-- As recusas antigas já foram tratadas à mão: não geram um email novo.
UPDATE preinscricao_docs SET recusa_avisada_em = COALESCE(validated_at, now())
 WHERE estado = 'recusado' AND recusa_avisada_em IS NULL;

ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS recusa_email_em timestamptz;
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS lembrete_enviado_em timestamptz;
UPDATE preinscricoes p
   SET lembrete_enviado_em = c.ultimo
  FROM (SELECT preinscricao_id, max(created_at) AS ultimo
          FROM preinscricao_contactos
         WHERE nota ILIKE 'Lembrete automático%' OR nota ILIKE 'Último lembrete automático%'
         GROUP BY preinscricao_id) c
 WHERE c.preinscricao_id = p.id AND p.lembrete_enviado_em IS NULL AND p.lembretes_enviados > 0;

ALTER TABLE formando_docs ADD COLUMN IF NOT EXISTS recusa_avisada_em timestamptz;
UPDATE formando_docs SET recusa_avisada_em = COALESCE(validated_at, now())
 WHERE estado = 'recusado' AND recusa_avisada_em IS NULL;

ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS lembrete_docs_em timestamptz;
ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS lembretes_docs_enviados integer NOT NULL DEFAULT 0;
ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS lembrete_docs_enviado_em timestamptz;
ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS recusa_email_em timestamptz;
CREATE INDEX IF NOT EXISTS formandos_fin_lembrete_docs_idx ON formandos_fin (lembrete_docs_em) WHERE lembrete_docs_em IS NOT NULL;
CREATE INDEX IF NOT EXISTS preinscricao_docs_recusa_idx ON preinscricao_docs (preinscricao_id) WHERE estado = 'recusado' AND recusa_avisada_em IS NULL;

INSERT INTO email_templates (tipo, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito) VALUES
('documento_recusado', 'Documento recusado · pedido de reenvio',
 'Documentos a corrigir: inscrição no curso {{curso}} | ENA',
 '["Analisámos os documentos que enviou para a inscrição no curso {{curso}} e não foi possível aceitar os seguintes:<br>{{documentos_recusados_itens}}", "Pedimos que volte a enviar estes documentos, já corrigidos, através do botão abaixo. A sua ligação pessoal mantém-se activa até a documentação ficar regularizada.", "Caso tenha alguma dúvida, estamos ao seu dispor através dos seguintes contactos:<br>{{telefones_itens}}"]'::jsonb,
 E'<email>\n  <p>Analisámos os documentos que enviou para a inscrição no curso {{curso}} e não foi possível aceitar os seguintes:<br>{{documentos_recusados_itens}}</p>\n  <p>Pedimos que volte a enviar estes documentos, já corrigidos, através do botão abaixo. A sua ligação pessoal mantém-se activa até a documentação ficar regularizada.</p>\n  <p>Caso tenha alguma dúvida, estamos ao seu dispor através dos seguintes contactos:<br>{{telefones_itens}}</p>\n  <cta ambito="documentos" href="{{documentos_url}}">Corrigir documentos</cta>\n</email>\n',
 'Corrigir documentos', '{{documentos_url}}', 'documentos')
ON CONFLICT (tipo) DO NOTHING;
