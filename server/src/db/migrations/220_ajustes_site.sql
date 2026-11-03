-- Ajustes de conteúdo às páginas do site já gravadas (src/db/ajustesSite.ts): cada um corre uma só vez.
CREATE TABLE IF NOT EXISTS ajustes_site (
  id text PRIMARY KEY,
  aplicado_em timestamptz NOT NULL DEFAULT now()
);
