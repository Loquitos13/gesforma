-- Grelha-tipo da simulação pedagógica (critérios de avaliação), antes fixa no frontend.
-- Usa-se quando a ficha do curso ainda não tem critérios próprios. Editável pela equipa.
ALTER TABLE conteudos_modelo DROP CONSTRAINT IF EXISTS conteudos_modelo_tipo_check;
ALTER TABLE conteudos_modelo ADD CONSTRAINT conteudos_modelo_tipo_check CHECK (tipo IN ('site', 'modulos', 'criterios'));

INSERT INTO conteudos_modelo (chave, tipo, regime, padrao, payload) VALUES
('criterios:ccp', 'criterios', 'gold', 'ccp', '{"criterios":[
  {"id":"planif","label":"Planificação da sessão"},
  {"id":"comun","label":"Comunicação e linguagem"},
  {"id":"metodos","label":"Métodos e técnicas pedagógicas"},
  {"id":"grupo","label":"Gestão do grupo e do tempo"},
  {"id":"recursos","label":"Utilização de recursos didáticos"},
  {"id":"aval","label":"Avaliação das aprendizagens"}
]}'::jsonb)
ON CONFLICT (chave) DO NOTHING;
