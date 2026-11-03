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

/** Páginas livres (pagina = «livre-<endereço>»), com o título e se já estão publicadas. */
export function listarLivres(c: Consulta) {
  return many<{ pagina: string; titulo: string; publicado_em: unknown; atualizado_em: unknown }>(c,
    "SELECT pagina, titulo, publicado_em, atualizado_em FROM site_paginas WHERE pagina LIKE 'livre-%' ORDER BY titulo, pagina");
}

export async function criarLivre(c: Consulta, pagina: string, titulo: string, dados: unknown, actorId: string) {
  const r = await one<{ pagina: string }>(c,
    `INSERT INTO site_paginas (pagina, titulo, rascunho, atualizado_por) VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (pagina) DO NOTHING RETURNING pagina`, [pagina, titulo, JSON.stringify(dados), actorId]);
  return Boolean(r);
}

export async function tituloDaLivre(c: Consulta, pagina: string) {
  return (await one<{ titulo: string }>(c, "SELECT titulo FROM site_paginas WHERE pagina = $1", [pagina]))?.titulo ?? null;
}

export async function apagarLivre(c: Consulta, pagina: string) {
  await many(c, "DELETE FROM site_paginas WHERE pagina = $1 AND pagina LIKE 'livre-%'", [pagina]);
}
