-- Ficha individual de avaliação da aprendizagem (qualitativa), preenchida pelo formador e impressa para o dossiê.
-- formando_id 0 guarda o que é da turma (as competências a adquirir, iguais para todos).
CREATE TABLE IF NOT EXISTS avaliacao_qualitativa (
  regime text NOT NULL,
  turma_id integer NOT NULL,
  formando_id integer NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  atualizado_por text NOT NULL DEFAULT '',
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (regime, turma_id, formando_id)
);
