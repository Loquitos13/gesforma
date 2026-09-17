CREATE TABLE IF NOT EXISTS turma_sessoes (
  regime text NOT NULL CHECK (regime IN ('gold', 'fin')),
  turma_id integer NOT NULL,
  sessao_n integer NOT NULL,
  plano jsonb,
  sumario jsonb,
  presencas jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (regime, turma_id, sessao_n)
);

CREATE TABLE IF NOT EXISTS turma_documentos (
  regime text NOT NULL CHECK (regime IN ('gold', 'fin')),
  turma_id integer NOT NULL,
  grupo_id text NOT NULL,
  label text NOT NULL,
  estado text NOT NULL DEFAULT 'falta' CHECK (estado IN ('ok', 'parcial', 'falta')),
  detalhe text NOT NULL DEFAULT '',
  payload jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (regime, turma_id, grupo_id, label)
);

CREATE TABLE IF NOT EXISTS turma_dtp (
  regime text NOT NULL CHECK (regime IN ('gold', 'fin')),
  turma_id integer NOT NULL,
  item_id text NOT NULL,
  estado text NOT NULL DEFAULT 'falta' CHECK (estado IN ('ok', 'parcial', 'falta')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (regime, turma_id, item_id)
);

CREATE TABLE IF NOT EXISTS turma_certificados (
  regime text NOT NULL CHECK (regime IN ('gold', 'fin')),
  turma_id integer NOT NULL,
  formando_id integer NOT NULL,
  emitido boolean NOT NULL DEFAULT false,
  nota numeric,
  elearning integer,
  emitido_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (regime, turma_id, formando_id)
);

CREATE TABLE IF NOT EXISTS curso_fichas (
  regime text NOT NULL CHECK (regime IN ('gold', 'fin')),
  curso_id integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  criterios jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (regime, curso_id)
);

CREATE TABLE IF NOT EXISTS formando_docs (
  regime text NOT NULL CHECK (regime IN ('gold', 'fin')),
  formando_id integer NOT NULL,
  doc_id text NOT NULL,
  ok boolean NOT NULL DEFAULT false,
  file_name text NOT NULL DEFAULT '',
  data text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (regime, formando_id, doc_id)
);

CREATE TABLE IF NOT EXISTS formando_notas (
  id serial PRIMARY KEY,
  regime text NOT NULL CHECK (regime IN ('gold', 'fin')),
  formando_id integer NOT NULL,
  autor text NOT NULL DEFAULT '',
  actor_id uuid,
  texto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS formando_notas_idx ON formando_notas (regime, formando_id, created_at DESC);

CREATE TABLE IF NOT EXISTS formador_docs (
  formador_id integer NOT NULL,
  doc_id text NOT NULL,
  uploaded boolean NOT NULL DEFAULT false,
  file_name text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (formador_id, doc_id)
);

CREATE TABLE IF NOT EXISTS inquerito_respostas (
  id serial PRIMARY KEY,
  inquerito_id integer NOT NULL,
  turma text NOT NULL DEFAULT '',
  formando text NOT NULL DEFAULT '',
  respostas jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS inquerito_respostas_idx ON inquerito_respostas (inquerito_id, created_at DESC);

CREATE TABLE IF NOT EXISTS notificacoes_lidas (
  actor_id uuid NOT NULL,
  chave text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, chave)
);

ALTER TABLE preinscricoes ADD COLUMN IF NOT EXISTS proximo_contacto text NOT NULL DEFAULT '';

ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS tematica text NOT NULL DEFAULT '';
