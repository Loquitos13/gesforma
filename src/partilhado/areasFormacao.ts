/**
 * As áreas de formação do site, pela ordem em que aparecem (filtros e botões das áreas). Os cursos financiados ficam
 * todos em «Formação Financiada»; uma área fora da lista aparece depois destas, por ordem alfabética.
 */
export const AREAS_FORMACAO = [
  "CCP e Gestão da Formação",
  "Informática e IA",
  "Saúde e Bem Estar",
  "Gestão de Pessoas e Desenvolvimento",
  "Marketing, Business e Comunicação",
  "Seguros e Fundos de Pensões",
  "Formação Financiada",
] as const;

export const AREA_FINANCIADA = "Formação Financiada";

const chave = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const POSICAO = new Map(AREAS_FORMACAO.map((a, i) => [chave(a), i]));

/** Ordena uma lista de áreas: primeiro as da lista, pela ordem dela; depois as outras, alfabeticamente. */
export function ordenarAreas(areas: string[]) {
  return [...areas].sort((a, b) => {
    const pa = POSICAO.get(chave(a)) ?? Infinity;
    const pb = POSICAO.get(chave(b)) ?? Infinity;
    return pa !== pb ? pa - pb : a.localeCompare(b, "pt");
  });
}
