CREATE TABLE IF NOT EXISTS crm_etiquetas (
  id serial PRIMARY KEY,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#64748b',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE preinscricoes
  ADD COLUMN IF NOT EXISTS meio_contacto text NOT NULL DEFAULT '';
ALTER TABLE preinscricoes
  ADD COLUMN IF NOT EXISTS etiqueta_id integer REFERENCES crm_etiquetas(id) ON DELETE SET NULL;

ALTER TABLE preinscricao_contactos
  ADD COLUMN IF NOT EXISTS meio text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS preinscricoes_etiqueta_idx ON preinscricoes (etiqueta_id);

INSERT INTO crm_etiquetas (nome, cor)
SELECT v.nome, v.cor FROM (VALUES
  ('Quente', '#dc2626'),
  ('Morno', '#f59e0b'),
  ('Frio', '#2563eb'),
  ('VIP', '#7c3aed'),
  ('Sem resposta', '#64748b')
) AS v(nome, cor)
WHERE NOT EXISTS (SELECT 1 FROM crm_etiquetas e WHERE e.nome = v.nome);
