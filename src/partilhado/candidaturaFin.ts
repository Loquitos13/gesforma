// Candidatura da Financiada: o enquadramento do programa que sai no cabeçalho da ficha de inscrição e da folha de
// presenças / sumário (Configurações › Financiada). Vale para todas as turmas da Financiada da entidade.
// Sem nada gravado usam-se os valores da candidatura PESSOAS 2030 em curso; um campo gravado em branco sai em branco.
// Partilhado entre o backoffice (formulário) e o servidor (PDF). Sem imports: o servidor compila este ficheiro tal como está.

export type CandidaturaFin = {
  programa: string;
  prioridade: string;
  tipologiaAcao: string;
  tipologiaIntervencao: string;
  tipologiaOperacao: string;
  tipologia: string;
};

export const CANDIDATURA_FIN_OMISSAO: CandidaturaFin = {
  programa: "PESSOAS 2030 (Programa Temático Demografia, Qualificações e Inclusão)",
  prioridade: "4C. Mais e melhor (re) qualificação de adultos para crescer",
  tipologiaAcao: "ESO4.7-01 – (Re) Qualificação de adultos",
  tipologiaIntervencao: "ESO4.7-01-01 – Formação de ativos para a empregabilidade",
  tipologiaOperacao: "4030 - Formações Modulares Certificadas",
  tipologia: "1.08. Formação Modular para Empregados e Desempregados",
};

/** Os campos pela ordem dos documentos, com o rótulo que lá aparece. */
export const CAMPOS_CANDIDATURA_FIN: { chave: keyof CandidaturaFin; rotulo: string }[] = [
  { chave: "programa", rotulo: "Programa" },
  { chave: "prioridade", rotulo: "Prioridade do Programa" },
  { chave: "tipologiaAcao", rotulo: "Tipologia de Ação" },
  { chave: "tipologiaIntervencao", rotulo: "Tipologia de Intervenção" },
  { chave: "tipologiaOperacao", rotulo: "Tipologia de Operação" },
  { chave: "tipologia", rotulo: "Tipologia" },
];

export const CANDIDATURA_FIN_MAX = 200;

/** Valores gravados (definição `candidatura_fin`) completados com os da omissão: só o campo que nunca foi gravado a usa. */
export function lerCandidaturaFin(values: Record<string, unknown> | undefined | null): CandidaturaFin {
  const v = values ?? {};
  const out = { ...CANDIDATURA_FIN_OMISSAO };
  for (const { chave } of CAMPOS_CANDIDATURA_FIN) {
    const raw = v[chave];
    if (raw == null) continue;
    out[chave] = String(raw).replace(/\s+/g, " ").trim().slice(0, CANDIDATURA_FIN_MAX);
  }
  return out;
}
