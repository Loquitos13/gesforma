-- Anexos das regras de email (ex.: o guia do registo no Netforce: sai com cada email da regra), regras para vários
-- cursos e o aviso «formando inserido numa turma» (o email do Netforce para o CCP).
CREATE TABLE IF NOT EXISTS email_regra_anexos (
  id serial PRIMARY KEY,
  rule_id integer NOT NULL REFERENCES email_rules(id) ON DELETE CASCADE,
  nome text NOT NULL,
  mime text NOT NULL,
  tamanho integer NOT NULL,
  conteudo bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS email_regra_anexos_regra_idx ON email_regra_anexos (rule_id);

-- Regras: um ou vários cursos (vazio = todos). A coluna «curso» antiga passa para a lista.
ALTER TABLE email_rules ADD COLUMN IF NOT EXISTS cursos text[];
UPDATE email_rules SET cursos = ARRAY[curso] WHERE curso IS NOT NULL AND trim(curso) <> '' AND cursos IS NULL;

-- Entradas em turma já vistas (o aviso «formando inserido numa turma» sai uma vez por formando e turma). As que já
-- existem contam como vistas: não sai nada a quem já estava nas turmas.
CREATE TABLE IF NOT EXISTS formando_turma_vistos (
  regime text NOT NULL,
  formando_id integer NOT NULL,
  turma_id integer NOT NULL,
  visto_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (regime, formando_id, turma_id)
);
INSERT INTO formando_turma_vistos (regime, formando_id, turma_id)
SELECT 'gold', id, turma_id FROM formandos_gold WHERE turma_id IS NOT NULL
ON CONFLICT DO NOTHING;
INSERT INTO formando_turma_vistos (regime, formando_id, turma_id)
SELECT 'fin', id, turma_id FROM formandos_fin WHERE turma_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Modelo «Registo no Netforce» (sem «Olá …»: o texto começa por «Caro(a) Formando(a)»).
INSERT INTO email_templates (tipo, area, nome, assunto, body_lines, body_xml, cta, cta_href, cta_ambito)
SELECT 'registo_netforce', a.area, 'Registo no Netforce (CCP)', 'Registo obrigatório no portal Netforce · {{curso}}',
  '["Caro(a) Formando(a)", "Para formalizar a sua inscrição, é imprescindível que efetue o seu registo no portal oficial do Netforce: http://netforce.iefp.pt, nas próximas 24 horas.", "Caso não efetue esse registo dentro desse prazo, a sua inscrição ficará sem efeito para este cronograma, podendo apenas realizar o curso novamente num próximo cronograma, caso existam vagas disponíveis.", "O registo no Netforce é obrigatório, uma vez que é através deste portal que a sua matrícula será validada e, posteriormente, emitido o seu Certificado de Competências Pedagógicas (CCP).", "Para proceder ao registo no portal Netforce, por favor siga os seguintes passos:", "1. Aceda ao site: http://netforce.iefp.pt<br>2. Clique em “LOGIN OU REGISTO” (no canto superior direito)<br>3. Escolha a opção “Registar”<br>4. Siga os passos indicados no documento em anexo", "Após criar a sua conta, receberá um e-mail de confirmação de registo.", "Caso não o receba, por favor, verifique a pasta de SPAM, Correio Indesejado ou Promoções.", "Depois de validar a criação da conta através do link enviado por e-mail, deverá aceder novamente ao portal, efetuar o login, concluir o registo de utente e proceder à atualização dos seus dados pessoais e de contacto.", "Para o/a apoiar neste processo, anexamos um documento detalhado com todos os passos necessários.", "O registo apenas será considerado concluído quando alcançar o menu correspondente à imagem 9 do documento anexo. Só a partir desse momento será possível comunicarmos ao IEFP a sua participação no curso.", "Se tiver alguma dúvida, não hesite em contactar-nos .", "Agradecemos a sua colaboração.", "Cumprimentos"]'::jsonb,
  '<email saudacao="nao">
  <p>Caro(a) Formando(a)</p>
  <p>Para formalizar a sua inscrição, é imprescindível que efetue o seu registo no portal oficial do Netforce: http://netforce.iefp.pt, nas próximas 24 horas.</p>
  <p>Caso não efetue esse registo dentro desse prazo, a sua inscrição ficará sem efeito para este cronograma, podendo apenas realizar o curso novamente num próximo cronograma, caso existam vagas disponíveis.</p>
  <p>O registo no Netforce é obrigatório, uma vez que é através deste portal que a sua matrícula será validada e, posteriormente, emitido o seu Certificado de Competências Pedagógicas (CCP).</p>
  <p>Para proceder ao registo no portal Netforce, por favor siga os seguintes passos:</p>
  <p>1. Aceda ao site: http://netforce.iefp.pt<br>2. Clique em “LOGIN OU REGISTO” (no canto superior direito)<br>3. Escolha a opção “Registar”<br>4. Siga os passos indicados no documento em anexo</p>
  <p>Após criar a sua conta, receberá um e-mail de confirmação de registo.</p>
  <p>Caso não o receba, por favor, verifique a pasta de SPAM, Correio Indesejado ou Promoções.</p>
  <p>Depois de validar a criação da conta através do link enviado por e-mail, deverá aceder novamente ao portal, efetuar o login, concluir o registo de utente e proceder à atualização dos seus dados pessoais e de contacto.</p>
  <p>Para o/a apoiar neste processo, anexamos um documento detalhado com todos os passos necessários.</p>
  <p>O registo apenas será considerado concluído quando alcançar o menu correspondente à imagem 9 do documento anexo. Só a partir desse momento será possível comunicarmos ao IEFP a sua participação no curso.</p>
  <p>Se tiver alguma dúvida, não hesite em contactar-nos .</p>
  <p>Agradecemos a sua colaboração.</p>
  <p>Cumprimentos</p>
</email>
', '', '', 'contacto'
  FROM (VALUES ('gold'), ('fin')) AS a(area)
ON CONFLICT (tipo, area) DO NOTHING;

-- Regra: quando o formando é inserido numa turma do CCP (Gold). O PDF do guia junta-se à regra no arranque.
INSERT INTO email_rules (nome, trigger_key, gatilho_label, template_tipo, delay_seconds, curso, ativo, dias, area, cursos)
SELECT 'Registo no Netforce (CCP)', 'formando.inserido_turma', 'Formando inserido numa turma', 'registo_netforce', 0, NULL, true, NULL, 'gold',
       ARRAY['Formação de Formadores - CCP']
 WHERE NOT EXISTS (SELECT 1 FROM email_rules WHERE trigger_key = 'formando.inserido_turma' AND template_tipo = 'registo_netforce');
