/** Páginas do site feitas no editor visual: rascunho e versão publicada (JSON dos blocos). */
import { many, one, type Consulta } from "./sql.js";

import type { PaginaSite } from "../../../src/partilhado/siteBlocos.js";

export type { PaginaSite };

export async function lerPagina(c: Consulta, pagina: PaginaSite) {
  return one<{ rascunho: unknown; publicado: unknown; publicado_em: unknown; atualizado_em: unknown }>(c,
    "SELECT rascunho, publicado, publicado_em, atualizado_em FROM site_paginas WHERE pagina = $1", [pagina]);
}

export async function lerPublicada(c: Consulta, pagina: PaginaSite) {
  const r = await one<{ publicado: unknown }>(c, "SELECT publicado FROM site_paginas WHERE pagina = $1", [pagina]);
  return r?.publicado ?? null;
}

export async function gravarRascunho(c: Consulta, pagina: PaginaSite, dados: unknown, actorId: string) {
  await many(c,
    `INSERT INTO site_paginas (pagina, rascunho, atualizado_por) VALUES ($1, $2::jsonb, $3)
     ON CONFLICT (pagina) DO UPDATE SET rascunho = EXCLUDED.rascunho, atualizado_em = now(), atualizado_por = EXCLUDED.atualizado_por`,
    [pagina, JSON.stringify(dados), actorId]);
}

export async function publicar(c: Consulta, pagina: PaginaSite, dados: unknown, actorId: string) {
  await many(c,
    `INSERT INTO site_paginas (pagina, rascunho, publicado, publicado_em, atualizado_por) VALUES ($1, $2::jsonb, $2::jsonb, now(), $3)
     ON CONFLICT (pagina) DO UPDATE SET rascunho = EXCLUDED.rascunho, publicado = EXCLUDED.publicado,
       publicado_em = now(), atualizado_em = now(), atualizado_por = EXCLUDED.atualizado_por`,
    [pagina, JSON.stringify(dados), actorId]);
}
