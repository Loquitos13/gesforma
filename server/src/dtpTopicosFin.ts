/** Os 14 tópicos do dossiê da financiada. Os 13 primeiros são as pastas da Drive. */
export const TOPICOS_FIN = [
  { n: 1, pasta: "1. Enquadramento da ação", label: "Enquadramento da ação", hint: "Identificação, UFCD, programa, regulamento e enquadramento do financiador." },
  { n: 2, pasta: "2. Recursos pedagógicos e materiais didáticos", label: "Recursos pedagógicos e materiais", hint: "Manuais, textos de apoio, salas e equipamentos." },
  { n: 3, pasta: "3. Formadores", label: "Formadores", hint: "Contrato, CV e CCP de quem lecciona." },
  { n: 4, pasta: "4. Equipa Técnica", label: "Equipa técnica", hint: "Coordenação e técnicos da ação." },
  { n: 5, pasta: "5. Formandos", label: "Formandos", hint: "Fichas, contratos, elegibilidade e RGPD." },
  { n: 6, pasta: "6. Registos de assiduidade e de desenvolvimento das sessões", label: "Assiduidade e sessões", hint: "Cronograma, planos, sumários, presenças, horas e ocorrências." },
  { n: 7, pasta: "7. Ferramentas e critérios de avaliação da aprendizagem", label: "Avaliação da aprendizagem", hint: "Instrumentos, enunciados e pauta." },
  { n: 8, pasta: "8. Mecanismos de avaliação à ação formativa", label: "Avaliação da ação", hint: "Satisfação, execução e o relatório final gerado pelo GesForma." },
  { n: 9, pasta: "9. Processos e ferramentas de supervisão e apoio pedagógico", label: "Supervisão pedagógica", hint: "Apoio ao formador e registos de supervisão." },
  { n: 10, pasta: "10. Plano de informação e divulgação da oferta formativa", label: "Divulgação", hint: "Canais onde a turma foi divulgada." },
  { n: 11, pasta: "11. Certificados", label: "Certificados", hint: "Certificados emitidos e registo." },
  { n: 12, pasta: "12. Princípios de equidade e inclusão", label: "Equidade e inclusão", hint: "Medidas de acesso e adaptação." },
  { n: 13, pasta: "13. Articulação com Academia Digital", label: "Academia Digital", hint: "Ligação da turma à Academia Digital." },
  { n: 14, pasta: "14. Inquéritos da turma", label: "Inquéritos da turma", hint: "Respostas desta turma e o relatório. Não é o inquérito geral do regime." },
] as const;

const POR_ID: Record<string, number> = {
  "id-turma": 1,
  ufcd: 1,
  programa: 1,
  regulamento: 1,
  enquadramento: 1,
  instalacoes: 2,
  materiais: 2,
  "contrato-formador": 3,
  "cv-formador": 3,
  "ccp-formador": 3,
  equipa: 4,
  fichas: 5,
  cc: 5,
  ch: 5,
  "cv-formando": 5,
  iban: 5,
  emprego: 5,
  "contratos-f": 5,
  rgpd: 5,
  cronograma: 6,
  planos: 6,
  sumarios: 6,
  presencas: 6,
  horas: 6,
  ocorrencias: 6,
  instrumentos: 7,
  pauta: 7,
  satisfacao: 8,
  execucao: 8,
  relatorio: 8,
  supervisao: 9,
  divulgacao: 10,
  certificados: 11,
  equidade: 12,
  academia: 13,
  "inqueritos-turma": 14,
};

export function topicoFinDe(id: string) {
  return POR_ID[id.replace(/^extra:/, "")] ?? 1;
}

export function pastaTopicoFin(n: number) {
  return TOPICOS_FIN.find(t => t.n === n)?.pasta ?? TOPICOS_FIN[0].pasta;
}

export function pastaFinDoItem(id: string) {
  return pastaTopicoFin(topicoFinDe(id));
}
