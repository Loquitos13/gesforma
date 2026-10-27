/**
 * Textos de destaque do curso (ficha › Conteúdo do site), partilhados pelo backoffice, o servidor e o site.
 * - `resumo` («Texto de destaque (catálogo)»): curto, para cartões, listagens e a descrição na pesquisa.
 * - `sintese` («Enquadramento»): o texto longo da página do curso (com negrito, ligações e listas: textoFormatado.ts).
 * Vazios, valem os de sempre: o completo é a síntese; o destaque sai da síntese, cortado numa palavra com «…».
 */

import { textoSimples } from "./textoFormatado.js";

/** O destaque deve caber num cartão: o contador avisa a partir daqui. */
export const RESUMO_IDEAL = 160;
/** Limite duro do destaque (o servidor recusa mais). */
export const RESUMO_MAX = 200;
/** Limite do texto completo (generoso: só trava colagens acidentais). */
export const SINTESE_MAX = 10000;

/** Corta o texto (numa só linha) em `max` caracteres, no fim de uma palavra, com «…» quando corta. */
export function cortarNaPalavra(texto: string, max = RESUMO_IDEAL) {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= max) return limpo;
  const corte = limpo.slice(0, max);
  const espaco = corte.lastIndexOf(" ");
  const base = espaco > max * 0.5 ? corte.slice(0, espaco) : corte;
  return `${base.replace(/[\s,;:.\-–—]+$/, "")}…`;
}

/**
 * Os dois textos a mostrar, já com as regras de recurso aplicadas. O destaque próprio guarda a formatação
 * (textoFormatado.ts); o que sai da síntese é texto corrido. `resumoSimples` é o destaque sem marcas (pesquisa da Google).
 */
export function textosCurso(payload: { resumo?: unknown; sintese?: unknown }, recurso = "") {
  const proprio = typeof payload.resumo === "string" ? payload.resumo.replace(/\r\n?/g, "\n").trim() : "";
  const completo = (typeof payload.sintese === "string" ? payload.sintese.trim() : "") || recurso;
  const temProprio = Boolean(textoSimples(proprio));
  const resumo = temProprio ? proprio : cortarNaPalavra(textoSimples(completo));
  return { resumo, resumoSimples: temProprio ? textoSimples(proprio) : resumo, completo, resumoProprio: temProprio };
}
