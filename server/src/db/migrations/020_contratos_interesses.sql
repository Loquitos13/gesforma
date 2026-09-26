CREATE TABLE IF NOT EXISTS contratos_comerciais (
  id integer PRIMARY KEY,
  comercial_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preinscricao_id integer REFERENCES preinscricoes(id) ON DELETE SET NULL,
  proposta_id integer REFERENCES propostas_comerciais(id) ON DELETE SET NULL,
  cliente_nome text NOT NULL,
  cliente_email text NOT NULL DEFAULT '',
  curso text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'Assinado',
  assinado_em timestamptz,
  notas text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contratos_comercial_idx ON contratos_comerciais (comercial_id, created_at DESC);

CREATE TABLE IF NOT EXISTS cliente_interesses (
  id serial PRIMARY KEY,
  comercial_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preinscricao_id integer REFERENCES preinscricoes(id) ON DELETE SET NULL,
  cliente_nome text NOT NULL DEFAULT '',
  cliente_email text NOT NULL DEFAULT '',
  produto text NOT NULL,
  nota text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS interesses_comercial_idx ON cliente_interesses (comercial_id, created_at DESC);

INSERT INTO contratos_comerciais
  (id, comercial_id, preinscricao_id, proposta_id, cliente_nome, cliente_email, curso, valor, estado, assinado_em, notas)
SELECT nextval('ops_id_seq')::int, p.comercial_id, p.preinscricao_id, p.id, p.cliente_nome, p.cliente_email, p.curso, p.valor,
       'Assinado', COALESCE(p.resposta_em, p.enviada_em), COALESCE(p.resposta_cliente, '')
  FROM propostas_comerciais p
 WHERE p.estado = 'Aceite'
   AND NOT EXISTS (SELECT 1 FROM contratos_comerciais c WHERE c.proposta_id = p.id);

INSERT INTO cliente_interesses (comercial_id, preinscricao_id, cliente_nome, cliente_email, produto, nota)
SELECT pr.comercial_id, pr.id, trim(both from pr.nome || ' ' || pr.apelido), pr.email, pr.curso,
       CASE WHEN pr.notas = '' THEN 'Interesse registado na pré-inscrição.' ELSE pr.notas END
  FROM preinscricoes pr
 WHERE pr.comercial_id IS NOT NULL
   AND pr.curso <> ''
   AND NOT EXISTS (
     SELECT 1 FROM cliente_interesses i
      WHERE i.preinscricao_id = pr.id AND i.produto = pr.curso
   );
