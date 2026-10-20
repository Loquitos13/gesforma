-- Limites dos pedidos públicos na base de dados (na Vercel cada instância tem a sua memória: o limite em memória não chega).
-- A chave é um hash (nunca o email ou o IP em claro); a janela é fixa e recomeça quando passa.
CREATE TABLE IF NOT EXISTS limites_pedidos (
  chave text PRIMARY KEY,
  janela_inicio timestamptz NOT NULL DEFAULT now(),
  contagem integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS limites_pedidos_janela_idx ON limites_pedidos (janela_inicio);
