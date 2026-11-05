-- Perfil «personalizado»: a administração escolhe um ou mais perfis da equipa (comercial, coordenação Gold,
-- coordenação Financiada, contabilidade) e a pessoa fica com a soma. Em cada pedido, a API usa o perfil escolhido que
-- tem acesso àquela operação (e ao regime, Gold ou Financiada); a base vê sempre um perfil normal.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'secretaria', 'comercial', 'financiada', 'contabilidade', 'formador', 'formando', 'personalizado'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS perfis text[] NOT NULL DEFAULT '{}';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_perfis_check;
ALTER TABLE users ADD CONSTRAINT users_perfis_check
  CHECK (perfis <@ ARRAY['comercial', 'secretaria', 'financiada', 'contabilidade']::text[]);
