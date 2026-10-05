-- Tipo comercial: e-learning deixa de se chamar Gold. CCP e o resto do b-learning/presencial
-- ficam como Pré-inscrição, porque a pessoa entra numa turma e a documentação é validada.
UPDATE cursos_gold
   SET tipo = 'E-learning'
 WHERE lower(trim(tipo)) IN ('gold', 'pago')
   AND lower(trim(regime)) = 'e-learning';

UPDATE cursos_gold
   SET tipo = 'Pré-inscrição'
 WHERE lower(trim(tipo)) IN ('gold', 'pago')
   AND lower(trim(regime)) <> 'e-learning';

UPDATE catalog_items
   SET payload = jsonb_set(payload, '{nome}', '"E-learning"')
 WHERE kind = 'lista_opcoes'
   AND payload->>'lista' = 'tipos_curso'
   AND payload->>'nome' = 'Gold';

UPDATE catalog_items
   SET payload = jsonb_set(payload, '{nome}', '"E-learning"')
 WHERE kind = 'lista_opcoes'
   AND payload->>'lista' = 'tipos_curso'
   AND payload->>'nome' = 'Pago'
   AND NOT EXISTS (
     SELECT 1 FROM catalog_items
      WHERE kind = 'lista_opcoes'
        AND payload->>'lista' = 'tipos_curso'
        AND payload->>'nome' = 'E-learning'
   );

DELETE FROM catalog_items
 WHERE kind = 'lista_opcoes'
   AND payload->>'lista' = 'tipos_curso'
   AND payload->>'nome' IN ('Gold', 'Pago');

ALTER TABLE crm_parceiros ADD COLUMN IF NOT EXISTS comercial_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE crm_parceiros ADD COLUMN IF NOT EXISTS retribuicao text NOT NULL DEFAULT '';

ALTER TABLE propostas_comerciais ADD COLUMN IF NOT EXISTS cliente_id integer REFERENCES crm_clientes(id) ON DELETE SET NULL;
ALTER TABLE contratos_comerciais ADD COLUMN IF NOT EXISTS cliente_id integer REFERENCES crm_clientes(id) ON DELETE SET NULL;

ALTER TABLE formadores ADD COLUMN IF NOT EXISTS disponibilidade jsonb NOT NULL DEFAULT '["laboral","pos-laboral","sabado-manha","sabado-tarde"]';
ALTER TABLE formadores ADD COLUMN IF NOT EXISTS custo_hora numeric NOT NULL DEFAULT 0;
ALTER TABLE formadores ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE turmas_gold ADD COLUMN IF NOT EXISTS custo_hora_sala numeric NOT NULL DEFAULT 0;
