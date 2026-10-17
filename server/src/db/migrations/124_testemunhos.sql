-- Testemunhos deixados pelos formandos na área do formando. Só aparecem no site depois de aprovados
-- e se o formando autorizou a publicação. Um por conta (editar volta a pôr em revisão).
-- Apagar a conta apaga o testemunho (é conteúdo da pessoa).
CREATE TABLE IF NOT EXISTS testemunhos (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  curso text NOT NULL DEFAULT '',
  texto text NOT NULL,
  estrelas integer NOT NULL CHECK (estrelas BETWEEN 1 AND 5),
  autoriza_publicar boolean NOT NULL DEFAULT false,
  estado text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente', 'aprovado', 'recusado')),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  revisto_em timestamptz,
  revisto_por uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS testemunhos_estado_idx ON testemunhos (estado, atualizado_em DESC);
