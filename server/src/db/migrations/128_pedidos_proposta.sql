-- Pedidos de proposta do site (formulário da página Empresas e das páginas de serviço).
-- Ficam também nas notas do cliente (CRM › Clientes); aqui têm estado, para não se perderem.
CREATE TABLE IF NOT EXISTS pedidos_proposta (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  empresa text NOT NULL DEFAULT '',
  email text NOT NULL,
  telefone text NOT NULL DEFAULT '',
  servico text NOT NULL DEFAULT '',
  mensagem text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'novo' CHECK (estado IN ('novo', 'contactado', 'proposta', 'arquivado')),
  cliente_id integer REFERENCES crm_clientes(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pedidos_proposta_estado_idx ON pedidos_proposta (estado, criado_em DESC);
