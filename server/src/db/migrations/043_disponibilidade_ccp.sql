-- A disponibilidade antiga era um calendário por dia, ou uma lista vazia.
-- O Gold passa a usar os quatro horários CCP. Quem ainda não escolheu fica nos quatro.
UPDATE formadores
   SET disponibilidade = '["laboral","pos-laboral","sabado-manha","sabado-tarde"]'::jsonb
 WHERE disponibilidade = '[]'::jsonb
    OR (jsonb_typeof(disponibilidade) = 'array'
        AND jsonb_array_length(disponibilidade) > 0
        AND jsonb_typeof(disponibilidade -> 0) = 'object');
