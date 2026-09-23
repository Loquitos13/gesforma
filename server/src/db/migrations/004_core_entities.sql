CREATE TABLE IF NOT EXISTS cursos (
  id integer PRIMARY KEY,
  regime text NOT NULL DEFAULT 'gold',
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT '',
  preco numeric NOT NULL DEFAULT 0,
  horas integer NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'Ativo',
  ufcd_cod text NOT NULL DEFAULT '',
  ufcd text NOT NULL DEFAULT '',
  nome_comercial text NOT NULL DEFAULT '',
  site_data jsonb NOT NULL DEFAULT '{}',
  parametros_avaliacao jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS formadores (
  id integer PRIMARY KEY,
  nome text NOT NULL,
  telf text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  especialidade text NOT NULL DEFAULT '',
  ccp text NOT NULL DEFAULT '',
  nif text NOT NULL DEFAULT '',
  regimes jsonb NOT NULL DEFAULT '["gold"]',
  estado text NOT NULL DEFAULT 'Ativo',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS turmas (
  id integer PRIMARY KEY,
  regime text NOT NULL DEFAULT 'gold',
  nome text NOT NULL,
  curso text NOT NULL,
  local text NOT NULL DEFAULT '',
  horario text NOT NULL DEFAULT '',
  data_inicio text NOT NULL DEFAULT '',
  vagas integer NOT NULL DEFAULT 16,
  total_alunos integer NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'Ativa',
  horas integer NOT NULL DEFAULT 0,
  formador text NOT NULL DEFAULT '',
  ufcd_cod text NOT NULL DEFAULT '',
  activa boolean NOT NULL DEFAULT true,
  cronograma jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS preinscricoes (
  id integer PRIMARY KEY,
  inscrito text NOT NULL DEFAULT '',
  nome text NOT NULL,
  apelido text NOT NULL DEFAULT '',
  email text NOT NULL,
  telf text NOT NULL DEFAULT '',
  inicio_curso text NOT NULL DEFAULT '',
  concelho text NOT NULL DEFAULT '',
  local text NOT NULL DEFAULT '',
  curso text NOT NULL DEFAULT '',
  preco numeric NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'Não contactado',
  campanha text NOT NULL DEFAULT '',
  origem text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS formandos_turmas (
  id integer PRIMARY KEY,
  nome text NOT NULL,
  apelido text NOT NULL DEFAULT '',
  telf text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  inscrito text NOT NULL DEFAULT '',
  local text NOT NULL DEFAULT '',
  curso text NOT NULL DEFAULT '',
  turma text NOT NULL DEFAULT '',
  turma_id integer NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'Formando',
  pago boolean NOT NULL DEFAULT false,
  valor numeric NOT NULL DEFAULT 0,
  metodo text NOT NULL DEFAULT '-',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS formandos_fin (
  id integer PRIMARY KEY,
  nome text NOT NULL,
  apelido text NOT NULL DEFAULT '',
  turma text NOT NULL DEFAULT '',
  telf text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  curso text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'Elegível',
  cc jsonb NOT NULL DEFAULT '{"ok": false, "data": ""}',
  ch jsonb NOT NULL DEFAULT '{"ok": false, "data": ""}',
  cu jsonb NOT NULL DEFAULT '{"ok": false, "data": ""}',
  ci jsonb NOT NULL DEFAULT '{"ok": false, "data": ""}',
  ce jsonb NOT NULL DEFAULT '{"ok": false, "data": ""}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transacoes (
  id text PRIMARY KEY,
  nome text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  metodo text NOT NULL DEFAULT 'MB Way',
  curso text NOT NULL DEFAULT '',
  data text NOT NULL DEFAULT '',
  estado text NOT NULL DEFAULT 'Pago',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dtp_turmas (
  turma_id integer PRIMARY KEY,
  regime text NOT NULL DEFAULT 'gold',
  pip_items jsonb NOT NULL DEFAULT '[]',
  sim_items jsonb NOT NULL DEFAULT '[]',
  documentos jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS catalogo_items (
  id serial PRIMARY KEY,
  tipo text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS catalogo_items_tipo_idx ON catalogo_items (tipo);

CREATE TABLE IF NOT EXISTS notificacoes (
  id serial PRIMARY KEY,
  tipo text NOT NULL,
  titulo text NOT NULL,
  texto text NOT NULL,
  tempo text NOT NULL DEFAULT 'agora',
  lida boolean NOT NULL DEFAULT false,
  view text NOT NULL DEFAULT 'painel',
  turma_id integer,
  tab text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS configuracoes (
  id text PRIMARY KEY,
  dados jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inqueritos (
  id serial PRIMARY KEY,
  regime text NOT NULL DEFAULT 'gold',
  titulo text NOT NULL,
  perguntas jsonb NOT NULL DEFAULT '[]',
  respostas jsonb NOT NULL DEFAULT '[]',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ficheiros (
  id uuid PRIMARY KEY,
  nome text NOT NULL,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  tamanho integer NOT NULL DEFAULT 0,
  base64_data text NOT NULL,
  contexto text NOT NULL DEFAULT '',
  referencia_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
