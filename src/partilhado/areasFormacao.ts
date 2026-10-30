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

/** Áreas antigas da Gold e a área do site para onde passaram (migração 211_areas_formacao_antigas.sql). */
const ALIASES_AREAS: Record<string, string> = {
  "desenvolvimento pessoal": "Gestão de Pessoas e Desenvolvimento",
  "boas praticas profissionais": "Gestão de Pessoas e Desenvolvimento",
  "boas praticas para a vida": "Saúde e Bem Estar",
  "boas praticas pedagogicas": "CCP e Gestão da Formação",
};

/** A área como aparece no site: a da lista (escrita como lá), a nova de uma área antiga, ou a própria. */
export function areaCanonica(area: string) {
  const k = chave(area);
  const i = POSICAO.get(k);
  return i != null ? AREAS_FORMACAO[i]! : ALIASES_AREAS[k] ?? area.trim();
}

/** Ordena uma lista de áreas: primeiro as da lista, pela ordem dela; depois as outras, alfabeticamente. */
export function ordenarAreas(areas: string[]) {
  return [...areas].sort((a, b) => {
    const pa = POSICAO.get(chave(a)) ?? Infinity;
    const pb = POSICAO.get(chave(b)) ?? Infinity;
    return pa !== pb ? pa - pb : a.localeCompare(b, "pt");
  });
}
