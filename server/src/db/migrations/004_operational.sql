CREATE TABLE IF NOT EXISTS cursos_gold (
  id integer PRIMARY KEY,
  nome text NOT NULL,
  categoria text NOT NULL DEFAULT '',
  tipo text NOT NULL DEFAULT 'Gold',
  preco numeric NOT NULL DEFAULT 0,
  regime text NOT NULL DEFAULT 'b-learning',
  horas integer NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'Ativo'
);

CREATE TABLE IF NOT EXISTS cursos_fin (
  id integer PRIMARY KEY,
  ufcd_cod text NOT NULL DEFAULT '',
  ufcd text NOT NULL,
  nome_comercial text NOT NULL DEFAULT '',
  regime text NOT NULL DEFAULT 'e-learning',
  horas integer NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'Ativo'
);

CREATE TABLE IF NOT EXISTS formadores (
  id integer PRIMARY KEY,
  nome text NOT NULL,
  telf text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  especialidade text NOT NULL DEFAULT '',
  ccp text NOT NULL DEFAULT '',
  nif text NOT NULL DEFAULT '',
  regimes jsonb NOT NULL DEFAULT '[]',
  estado text NOT NULL DEFAULT 'Ativo'
);

CREATE TABLE IF NOT EXISTS turmas_gold (
  id integer PRIMARY KEY,
  data_inicio text NOT NULL,
  nome text NOT NULL,
  curso text NOT NULL,
  local text NOT NULL DEFAULT '',
  horario text NOT NULL DEFAULT '',
  total_alunos integer NOT NULL DEFAULT 0,
  vagas integer NOT NULL DEFAULT 16,
  estado text NOT NULL DEFAULT 'Ativa',
  formador text NOT NULL DEFAULT '',
  horas integer NOT NULL DEFAULT 90,
  cronograma jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS turmas_fin (
  id integer PRIMARY KEY,
  data_inicio text NOT NULL,
  nome text NOT NULL,
  curso text NOT NULL,
  ufcd_cod text NOT NULL DEFAULT '',
  local text NOT NULL DEFAULT '',
  horario text NOT NULL DEFAULT '',
  alunos integer NOT NULL DEFAULT 0,
  alunos_total integer NOT NULL DEFAULT 20,
  estado text NOT NULL DEFAULT 'A montar',
  horas integer NOT NULL DEFAULT 25,
  formador text NOT NULL DEFAULT '',
  activa boolean NOT NULL DEFAULT true,
  cronograma jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS preinscricoes (
  id integer PRIMARY KEY,
  inscrito text NOT NULL,
  nome text NOT NULL,
  apelido text NOT NULL DEFAULT '',
  email text NOT NULL,
  telf text NOT NULL DEFAULT '',
  inicio_curso text NOT NULL DEFAULT '-',
  concelho text NOT NULL DEFAULT '',
  local text NOT NULL DEFAULT '',
  curso text NOT NULL DEFAULT '',
  preco numeric NOT NULL DEFAULT 0,
  estado text NOT NULL DEFAULT 'Não contactado',
  campanha text NOT NULL DEFAULT '',
  origem text NOT NULL DEFAULT 'Website',
  contactado_em timestamptz,
  notas text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS preinscricoes_estado_idx ON preinscricoes (estado, created_at DESC);
CREATE INDEX IF NOT EXISTS preinscricoes_email_idx ON preinscricoes (email);

CREATE TABLE IF NOT EXISTS preinscricao_contactos (
  id serial PRIMARY KEY,
  preinscricao_id integer NOT NULL REFERENCES preinscricoes(id) ON DELETE CASCADE,
  actor_id uuid,
  nota text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS formandos_gold (
  id integer PRIMARY KEY,
  nome text NOT NULL,
  apelido text NOT NULL DEFAULT '',
  telf text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  inscrito text NOT NULL DEFAULT '',
  local text NOT NULL DEFAULT '',
  curso text NOT NULL DEFAULT '',
  turma text NOT NULL DEFAULT '',
  turma_id integer,
  estado text NOT NULL DEFAULT 'Formando',
  pago boolean NOT NULL DEFAULT false,
  valor numeric NOT NULL DEFAULT 0,
  metodo text NOT NULL DEFAULT '-'
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
  docs jsonb NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS campanhas (
  id integer PRIMARY KEY,
  nome text NOT NULL,
  data text NOT NULL,
  encarregado text NOT NULL DEFAULT '',
  preinscricoes integer NOT NULL DEFAULT 0,
  pagos integer NOT NULL DEFAULT 0,
  receita numeric NOT NULL DEFAULT 0,
  custo numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id integer PRIMARY KEY,
  titulo text NOT NULL,
  slug text NOT NULL,
  data text NOT NULL,
  status text NOT NULL DEFAULT 'Ativo'
);

CREATE TABLE IF NOT EXISTS pagamentos (
  id text PRIMARY KEY,
  nome text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  metodo text NOT NULL DEFAULT '',
  curso text NOT NULL DEFAULT '',
  data text NOT NULL,
  estado text NOT NULL DEFAULT 'Pendente'
);

CREATE SEQUENCE IF NOT EXISTS ops_id_seq START WITH 20000;
