ALTER TABLE preinscricoes
  ADD COLUMN IF NOT EXISTS extras jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS crm_campos (
  id serial PRIMARY KEY,
  label text NOT NULL,
  chave text NOT NULL UNIQUE,
  tipo text NOT NULL DEFAULT 'texto',
  opcoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_campo_valores (
  lead_id integer NOT NULL REFERENCES preinscricoes(id) ON DELETE CASCADE,
  campo_id integer NOT NULL REFERENCES crm_campos(id) ON DELETE CASCADE,
  valor text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, campo_id)
);

CREATE TABLE IF NOT EXISTS lead_eventos (
  id serial PRIMARY KEY,
  lead_id integer NOT NULL REFERENCES preinscricoes(id) ON DELETE CASCADE,
  actor_id uuid,
  tipo text NOT NULL,
  titulo text NOT NULL,
  detalhe text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_eventos_lead_idx ON lead_eventos (lead_id, created_at DESC);

INSERT INTO crm_campos (label, chave, tipo)
SELECT * FROM (VALUES
  ('NIF / NIPC', 'nif', 'texto'),
  ('Empresa / entidade', 'empresa', 'texto'),
  ('Horário preferido', 'horario', 'texto')
) AS v(label, chave, tipo)
WHERE NOT EXISTS (SELECT 1 FROM crm_campos c WHERE c.chave = v.chave);

INSERT INTO lead_eventos (lead_id, tipo, titulo, detalhe, created_at)
SELECT p.id, 'criacao', 'Lead criada',
       'Pedido via ' || COALESCE(NULLIF(p.origem, ''), 'desconhecida') || ' · ' || COALESCE(NULLIF(p.curso, ''), 'sem curso'),
       COALESCE(p.created_at, now())
  FROM preinscricoes p
 WHERE NOT EXISTS (SELECT 1 FROM lead_eventos e WHERE e.lead_id = p.id AND e.tipo = 'criacao');

INSERT INTO lead_eventos (lead_id, actor_id, tipo, titulo, detalhe, created_at)
SELECT c.preinscricao_id, c.actor_id, 'nota', 'Nota comercial',
       CASE WHEN c.nota = '' THEN 'Contacto registado.' ELSE c.nota END,
       c.created_at
  FROM preinscricao_contactos c
 WHERE NOT EXISTS (
   SELECT 1 FROM lead_eventos e
    WHERE e.lead_id = c.preinscricao_id
      AND e.tipo = 'nota'
      AND e.created_at = c.created_at
 );

INSERT INTO lead_eventos (lead_id, tipo, titulo, detalhe, created_at)
SELECT p.preinscricao_id, 'proposta', 'Proposta ' || lower(p.estado),
       COALESCE(NULLIF(p.curso, ''), 'sem curso') || ' · € ' || p.valor::text,
       COALESCE(p.enviada_em, p.created_at, now())
  FROM propostas_comerciais p
 WHERE p.preinscricao_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM lead_eventos e
      WHERE e.lead_id = p.preinscricao_id AND e.tipo = 'proposta' AND e.created_at = COALESCE(p.enviada_em, p.created_at)
   );
