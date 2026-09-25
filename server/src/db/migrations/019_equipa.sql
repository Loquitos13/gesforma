ALTER TABLE preinscricoes
  ADD COLUMN IF NOT EXISTS comercial_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS preinscricoes_comercial_idx ON preinscricoes (comercial_id);

CREATE TABLE IF NOT EXISTS propostas_comerciais (
  id integer PRIMARY KEY,
  comercial_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preinscricao_id integer REFERENCES preinscricoes(id) ON DELETE SET NULL,
  cliente_nome text NOT NULL,
  cliente_email text NOT NULL DEFAULT '',
  curso text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'Enviada',
  resposta_cliente text NOT NULL DEFAULT '',
  resposta_em timestamptz,
  enviada_em timestamptz NOT NULL DEFAULT now(),
  notas text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS propostas_comercial_idx ON propostas_comerciais (comercial_id, enviada_em DESC);

-- Liga leads já existentes ao comercial da campanha (pelo nome do encarregado).
UPDATE preinscricoes p
   SET comercial_id = u.id
  FROM campanhas c
  JOIN users u ON lower(trim(u.name)) = lower(trim(c.encarregado))
 WHERE p.comercial_id IS NULL
   AND p.campanha <> ''
   AND p.campanha = c.nome
   AND u.role = 'comercial'
   AND u.active = true;
