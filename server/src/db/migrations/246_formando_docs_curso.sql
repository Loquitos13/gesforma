-- Fichas de formando criadas à mão (Formandos › Nova ficha): os documentos pedidos são os da ficha do curso no momento
-- em que a ficha é criada (obrigatórios como no curso; opcionais e condicionais como opcionais; os desmarcados no curso
-- ficam de fora). A lista fica guardada na ficha: mudar depois os documentos do curso não mexe nas fichas já guardadas.
-- Sem lista (fichas antigas), a ficha mantém a lista fixa do regime.
ALTER TABLE formandos_gold ADD COLUMN IF NOT EXISTS docs_lista jsonb;
ALTER TABLE formandos_fin ADD COLUMN IF NOT EXISTS docs_lista jsonb;
-- «Outros documentos» anexados pela equipa: o nome que aparece na ficha.
ALTER TABLE formando_docs ADD COLUMN IF NOT EXISTS rotulo text;
