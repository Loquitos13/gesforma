-- Campanhas por email aos pré-inscritos parados (mais de um mês, já contactados, sem documentos
-- completos ou que não passaram a formandos). Cada envio guarda os destinatários e fica como contacto.
CREATE TABLE IF NOT EXISTS campanha_envios (
  id serial PRIMARY KEY,
  campanha_id integer REFERENCES campanhas(id) ON DELETE SET NULL,
  assunto text NOT NULL DEFAULT '',
  criterios jsonb NOT NULL DEFAULT '{}'::jsonb,
  total integer NOT NULL DEFAULT 0,
  enviados integer NOT NULL DEFAULT 0,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campanha_envio_destinos (
  envio_id integer NOT NULL REFERENCES campanha_envios(id) ON DELETE CASCADE,
  preinscricao_id integer NOT NULL REFERENCES preinscricoes(id) ON DELETE CASCADE,
  enviado boolean NOT NULL DEFAULT false,
  erro text NOT NULL DEFAULT '',
  PRIMARY KEY (envio_id, preinscricao_id)
);
CREATE INDEX IF NOT EXISTS campanha_envio_destinos_lead_idx ON campanha_envio_destinos (preinscricao_id);

ALTER TABLE campanha_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanha_envios FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON campanha_envios;
CREATE POLICY gesforma_api ON campanha_envios FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

ALTER TABLE campanha_envio_destinos ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanha_envio_destinos FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS gesforma_api ON campanha_envio_destinos;
CREATE POLICY gesforma_api ON campanha_envio_destinos FOR ALL USING (current_setting('gesforma.api', true) = '1') WITH CHECK (current_setting('gesforma.api', true) = '1');

INSERT INTO email_templates (tipo, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito) VALUES
('campanha_preinscritos', 'Campanha · pré-inscritos', 'Ainda vai a tempo: {{curso}} | ENA',
 '["Há algum tempo fez a pré-inscrição no curso {{curso}} da ENA e ainda não conseguimos concluir a sua inscrição.", "Estas são as próximas turmas (veja o cronograma de cada uma):<br>{{cronogramas_itens}}", "Documentos em falta:<br>{{documentos_em_falta_itens}}", "Para qualquer dúvida, ligue para:<br>{{telefones_itens}}", "Se ainda tem interesse, conclua a inscrição pela sua ligação pessoal no botão abaixo."]'::jsonb,
 E'<email>\n  <p>Há algum tempo fez a pré-inscrição no curso {{curso}} da ENA e ainda não conseguimos concluir a sua inscrição.</p>\n  <p>Estas são as próximas turmas (veja o cronograma de cada uma):<br>{{cronogramas_itens}}</p>\n  <p>Documentos em falta:<br>{{documentos_em_falta_itens}}</p>\n  <p>Para qualquer dúvida, ligue para:<br>{{telefones_itens}}</p>
  <p>Se ainda tem interesse, conclua a inscrição pela sua ligação pessoal no botão abaixo.</p>\n  <cta ambito="documentos" href="{{documentos_url}}">Concluir inscrição</cta>\n</email>\n',
 'Concluir inscrição', '{{documentos_url}}', 'documentos')
ON CONFLICT (tipo) DO NOTHING;

-- Os envios passam pela fila dos emails automáticos (o cron envia-os aos poucos).
INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, curso, ativo)
SELECT 'Campanha aos pré-inscritos', 'campanha.preinscritos', 'Campanha por email (ecrã Campanhas)', 'campanha_preinscritos', 0, NULL, true
 WHERE NOT EXISTS (SELECT 1 FROM email_rules WHERE trigger_key = 'campanha.preinscritos');
