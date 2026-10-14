-- Fundação do redesign: colunas e índices para as estatísticas e listas novas.

-- Formadores: validade do CCP/CCPE.
ALTER TABLE formadores ADD COLUMN IF NOT EXISTS ccp_validade date;

-- Pré-inscrições ligadas à campanha por id (antes casavam pelo nome).
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS campanha_id integer;

UPDATE preinscricoes p
   SET campanha_id = c.id
  FROM campanhas c
 WHERE p.campanha_id IS NULL
   AND trim(p.campanha) <> ''
   AND lower(trim(p.campanha)) = lower(trim(c.nome));

-- Sem campanha escrita: só se liga quando há exactamente uma campanha para esse curso.
UPDATE preinscricoes p
   SET campanha_id = c.id
  FROM campanhas c
 WHERE p.campanha_id IS NULL
   AND trim(p.campanha) = ''
   AND coalesce(trim(c.curso), '') <> ''
   AND lower(trim(p.curso)) = lower(trim(c.curso))
   AND (SELECT count(*) FROM campanhas c2 WHERE lower(trim(c2.curso)) = lower(trim(c.curso))) = 1;

CREATE INDEX IF NOT EXISTS preinscricoes_campanha_id_idx ON preinscricoes (campanha_id);

-- "Como conheceu a ENA": o valor passa a ser sempre uma opção da lista `origens`.
-- O texto original fica guardado em origem_original.
ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS origem_original text;

UPDATE preinscricoes SET origem_original = origem WHERE origem_original IS NULL;

UPDATE preinscricoes
   SET origem = CASE
     WHEN origem ~* 'insta' THEN 'Instagram'
     WHEN origem ~* 'face' THEN 'Facebook'
     WHEN origem ~* 'linked' THEN 'LinkedIn'
     WHEN origem ~* 'iefp|emprego|centro' THEN 'IEFP'
     WHEN origem ~* 'whats' THEN 'WhatsApp'
     WHEN origem ~* 'google|pesquisa|org[aâ]nic' THEN 'Google'
     WHEN origem ~* 'site|web' THEN 'Website'
     WHEN origem ~* 'indica' THEN 'Indicação'
     WHEN origem ~* 'refer|amigo|colega|empresa|formador' THEN 'Referência'
     WHEN origem ~* 'telef|chamada' THEN 'Telefone'
     WHEN origem ~* 'e-?mail|newsletter' THEN 'Email'
     WHEN origem ~* 'balc|presencial' THEN 'Balcão'
     ELSE 'Outro'
   END
 WHERE origem NOT IN ('Website', 'Facebook', 'Instagram', 'Google', 'LinkedIn', 'IEFP', 'Referência',
                      'Telefone', 'WhatsApp', 'Email', 'Balcão', 'Indicação', 'Outro');

CREATE INDEX IF NOT EXISTS preinscricoes_origem_idx ON preinscricoes (origem);
CREATE INDEX IF NOT EXISTS preinscricoes_created_idx ON preinscricoes (created_at);

-- Pagamentos: data em que ficou pago (as estatísticas de receita usam-na).
ALTER TABLE pagamentos ADD COLUMN IF NOT EXISTS pago_em timestamptz;

UPDATE pagamentos
   SET pago_em = (substring(data from '^\d{4}-\d{2}-\d{2}'))::date
 WHERE pago_em IS NULL
   AND estado ILIKE 'pago%'
   AND data ~ '^\d{4}-\d{2}-\d{2}';

UPDATE pagamentos
   SET pago_em = to_date(substring(data from '^\d{2}/\d{2}/\d{4}'), 'DD/MM/YYYY')
 WHERE pago_em IS NULL
   AND estado ILIKE 'pago%'
   AND data ~ '^\d{2}/\d{2}/\d{4}';

CREATE INDEX IF NOT EXISTS pagamentos_estado_pago_idx ON pagamentos (estado, pago_em);

-- Inquéritos: quantas pessoas receberam cada envio (para a taxa de resposta).
ALTER TABLE inquerito_envios ADD COLUMN IF NOT EXISTS destinatarios integer NOT NULL DEFAULT 0;

-- Turmas: índices para as listas e "próximas turmas".
CREATE INDEX IF NOT EXISTS turmas_gold_inicio_idx ON turmas_gold (data_inicio);
CREATE INDEX IF NOT EXISTS turmas_fin_inicio_idx ON turmas_fin (data_inicio);

-- Auditoria: leitura por entidade e por data.
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON audit_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);

-- Financiada: entidade financiadora da turma (filtro do painel e das turmas).
ALTER TABLE turmas_fin ADD COLUMN IF NOT EXISTS financiador text NOT NULL DEFAULT '';
