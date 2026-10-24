// Os 4 tópicos da página do curso (substituem «Funcionamento e organização»): editam-se na ficha do curso
// (Conteúdo do site) e aparecem em cartões na página pública.

export const TOPICOS_CURSO = [
  { chave: "metodologias", rotulo: "Metodologias", ajuda: "Como decorre a formação: abordagem, sessões, plataforma. Uma ideia por linha (comece com «-» para uma lista)." },
  { chave: "certificacao", rotulo: "Certificação / Avaliação", ajuda: "Como se avalia e que certificado se obtém (aproveitamento, assiduidade mínima…)." },
  { chave: "destinatarios", rotulo: "Destinatários", ajuda: "Para quem é o curso." },
  { chave: "requisitos", rotulo: "Requisitos de integração / Funcionamento", ajuda: "Condições de acesso, equipamento e regras de funcionamento." },
] as const;

export type ChaveTopicoCurso = (typeof TOPICOS_CURSO)[number]["chave"];
export type TopicosCurso = Record<ChaveTopicoCurso, string>;

/** Os tópicos gravados na ficha; sem «Metodologias», vale o antigo «Funcionamento». */
export function topicosDoPayload(p: Record<string, unknown>): TopicosCurso {
  const t = (k: string) => (typeof p[k] === "string" ? (p[k] as string) : "");
  return {
    metodologias: t("metodologias") || t("funcionamento"),
    certificacao: t("certificacao"),
    destinatarios: t("destinatarios"),
    requisitos: t("requisitos"),
  };
}
