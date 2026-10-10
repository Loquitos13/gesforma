export type DtpFase = "antes" | "durante" | "depois";
export type DtpEstado = "ok" | "parcial" | "falta";
export type DtpAmbito = "turma" | "formando" | "formador";

/** Chave de derivação: quando existe, o estado sai dos dados reais da turma. */
export type DtpAuto =
  | "cronograma"
  | "planos"
  | "sumarios"
  | "presencas"
  | "pip"
  | "sim-ini"
  | "sim-fim"
  | "certificados"
  | "contratos"
  | "doc-cc"
  | "doc-ch"
  | "doc-cu"
  | "doc-ci"
  | "doc-ce"
  | "doc-morada"
  | "doc-rgpd-contratos"
  | "doc-exp"
  | "doc-regulamento"
  | "inqueritos-formador"
  | "inqueritos-formandos"
  | "inqueritos-pos";

export type DtpDef = {
  id: string;
  fase: DtpFase;
  label: string;
  fonte: string;
  hint: string;
  /** Tópico do dossiê da financiada, de 1 a 14. */
  topico?: number;
  /** Ordem dentro do tópico, como na lista da ação financiada. */
  ordem?: number;
  auto?: DtpAuto;
  bloqueante?: boolean;
  /** Norma legal: fica no dossiê de todos os cursos do regime e não se pode remover. */
  obrigatorio?: boolean;
  /** Existe na autofinanciada e na financiada, em qualquer formação. */
  universal?: boolean;
  ambito?: DtpAmbito;
};

/** Documento acrescentado por um curso concreto, além da estrutura base do regime. */

export type DtpExtraDef = {
  id: string;
  fase: DtpFase;
  label: string;
  fonte: string;
  hint: string;
  bloqueante?: boolean;
  /** Onde o ficheiro vive: dossiê da turma, de cada formando ou do formador. */
  ambito?: DtpAmbito;
};

/** Modelo do dossiê: o que se retira da base, o que se repõe e o que se acrescenta. */
export type DtpModelo = {
  excluidos: string[];
  /** Itens da base que a entidade retirou e este curso voltou a ligar. */
  incluidos?: string[];
  extra: DtpExtraDef[];
};

export const DTP_MODELO_VAZIO: DtpModelo = { excluidos: [], incluidos: [], extra: [] };

function jsonArr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  }
  return [];
}

function jsonObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      return p && typeof p === "object" && !Array.isArray(p) ? p as Record<string, unknown> : {};
    } catch { return {}; }
  }
  return {};
}

export function parseDtpModelo(row?: { excluidos?: unknown; extra?: unknown; incluidos?: unknown }): DtpModelo {
  if (!row) return DTP_MODELO_VAZIO;
  return {
    excluidos: jsonArr(row.excluidos).map(String),
    incluidos: jsonArr(row.incluidos).map(String),
    extra: jsonArr(row.extra).map(raw => {
      const x = jsonObj(raw);
      const fase = String(x.fase ?? "antes");
      return {
        id: String(x.id ?? ""),
        fase: (fase === "durante" || fase === "depois" ? fase : "antes") as DtpFase,
        label: String(x.label ?? ""),
        fonte: String(x.fonte ?? "ENA · exigência do curso"),
        hint: String(x.hint ?? ""),
        bloqueante: Boolean(x.bloqueante),
        ambito: (x.ambito === "formando" || x.ambito === "formador" ? x.ambito : "turma") as DtpAmbito,
      };
    }).filter(x => x.id && x.label),
  };
}

/**
 * A entidade define a estrutura. O curso só guarda o que muda:
 * exclusões a mais, itens da base que a entidade tirou e o curso repõe, e extras próprios.
 */
export function comporModelo(entidade: DtpModelo, curso: DtpModelo): DtpModelo {
  const repor = new Set(curso.incluidos ?? []);
  const excluidos = new Set<string>();
  for (const id of entidade.excluidos) {
    if (!repor.has(id)) excluidos.add(id);
  }
  for (const id of curso.excluidos) {
    if (!repor.has(id)) excluidos.add(id);
  }
  const extra: DtpExtraDef[] = [];
  const seen = new Set<string>();
  for (const x of [...entidade.extra, ...curso.extra]) {
    if (!x.id || seen.has(x.id)) continue;
    if (excluidos.has(x.id) || excluidos.has(`extra:${x.id}`)) continue;
    seen.add(x.id);
    extra.push(x);
  }
  return { excluidos: [...excluidos], incluidos: [...repor], extra };
}

export const DTP_FASES: { id: DtpFase; label: string; hint: string }[] = [
  { id: "antes", label: "Antes da turma", hint: "Abre o dossiê no dia em que a turma é aprovada." },
  { id: "durante", label: "Durante", hint: "O que só se recolhe em sala - não se reconstitui depois." },
  { id: "depois", label: "Fecho", hint: "Sem isto a turma não se encerra nem se emite certificado." },
];

const GOLD: DtpDef[] = [
  { id: "id-turma", fase: "antes", label: "Identificação da turma", fonte: "DGERT · Portaria 851/2010", hint: "Código interno, carga horária, regime, local e horário.", obrigatorio: true },
  { id: "programa", fase: "antes", label: "Programa de formação", fonte: "DGERT · Portaria 851/2010 a)", hint: "Objetivos, conteúdos, metodologias, critérios de avaliação e recursos.", obrigatorio: true },
  { id: "regulamento", fase: "antes", label: "Regulamento de formação", fonte: "DGERT · Portaria 851/2010", hint: "Regulamento da ENA aceite pelos formandos desta turma.", auto: "doc-regulamento", obrigatorio: true },
  { id: "divulgacao", fase: "antes", label: "Divulgação da turma", fonte: "DGERT · Portaria 851/2010 aa)", hint: "Campanha e página pública do curso.", obrigatorio: true },
  { id: "fichas", fase: "antes", label: "Fichas de inscrição", fonte: "DGERT · Portaria 851/2010 f)", hint: "Fichas dos formandos desta turma.", obrigatorio: true },
  { id: "contratos-f", fase: "antes", label: "Contratos de formação (formandos)", fonte: "DGERT · Portaria 851/2010 i)", hint: "Um contrato assinado por formando.", auto: "contratos", obrigatorio: true },
  { id: "contrato-formador", fase: "antes", label: "Contrato do formador", fonte: "DGERT · Portaria 851/2010 i)", hint: "Contrato do formador atribuído à turma.", obrigatorio: true },
  { id: "cv-formador", fase: "antes", label: "CV do formador", fonte: "IEFP · Anexo 5 DTP", hint: "CV actualizado no perfil do formador." },
  { id: "ccp-formador", fase: "antes", label: "CCP / CCPE do formador", fonte: "IEFP · Anexo 5 DTP", hint: "Certificado de competências pedagógicas válido." },
  { id: "habil-formador", fase: "antes", label: "Qualificação de nível superior do formador", fonte: "IEFP · Anexo 5 DTP", hint: "Certificado de habilitações do formador." },
  { id: "exp-formandos", fase: "antes", label: "Comprovativo de 5 anos de experiência (formandos)", fonte: "IEFP · Anexo 5 · acesso FPIF", hint: "Obrigatório no CCP.", auto: "doc-exp" },
  { id: "rgpd", fase: "antes", label: "Autorizações RGPD / imagem / dados digitais", fonte: "IEFP · Anexo 5 · RGPD", hint: "Necessário em b-learning (gravação de sessões)." },
  { id: "recibos", fase: "antes", label: "Comprovativos de pagamento / recibos", fonte: "Gold · autofinanciada", hint: "Específico do regime comercial." },
  { id: "cronograma", fase: "antes", label: "Cronograma da turma", fonte: "DGERT / IEFP", hint: "Plano de sessões da turma.", auto: "cronograma", obrigatorio: true },
  { id: "planos", fase: "antes", label: "Planos de sessão", fonte: "DGERT · Portaria 851/2010 j)", hint: "Um plano por sessão do cronograma.", auto: "planos", obrigatorio: true },
  { id: "sumarios", fase: "durante", label: "Sumários assinados pelo formador", fonte: "DGERT · Portaria 851/2010 l)", hint: "Sem sumário a sessão não existiu para auditoria.", auto: "sumarios", bloqueante: true, obrigatorio: true },
  { id: "presencas", fase: "durante", label: "Folhas de presença (formandos + formador)", fonte: "DGERT · Portaria 851/2010 l)", hint: "Uma folha por sessão realizada.", auto: "presencas", obrigatorio: true },
  { id: "pip", fase: "durante", label: "Projeto de intervenção pedagógica (PIP)", fonte: "IEFP · Anexo 5 · FPIF", hint: "Exclusivo CCP: um projecto por formando.", auto: "pip", bloqueante: true },
  { id: "sim-ini", fase: "durante", label: "Simulação pedagógica inicial", fonte: "IEFP · Anexo 5 · FPIF", hint: "Vídeo e grelha de observação por formando.", auto: "sim-ini", bloqueante: true },
  { id: "sim-fim", fase: "durante", label: "Simulação pedagógica final", fonte: "IEFP · Anexo 5 · FPIF", hint: "Vídeo e grelha do módulo final.", auto: "sim-fim" },
  { id: "instrumentos", fase: "durante", label: "Instrumentos de avaliação (enunciados / grelhas)", fonte: "DGERT · Portaria 851/2010 m) n)", hint: "Classificação sem instrumento não é verificável.", obrigatorio: true },
  { id: "ocorrencias", fase: "durante", label: "Registo de ocorrências", fonte: "DGERT · Portaria 851/2010 r)", hint: "Desistências, troca de formador, alteração de calendário.", obrigatorio: true },
  { id: "materiais", fase: "durante", label: "Materiais e textos de apoio", fonte: "DGERT · Portaria 851/2010", hint: "Manual e apresentações entregues à turma.", obrigatorio: true },
  { id: "pauta", fase: "depois", label: "Pauta / classificação final", fonte: "DGERT · Portaria 851/2010 o)", hint: "Classificação de cada formando.", obrigatorio: true },
  { id: "satisfacao", fase: "depois", label: "Avaliação de satisfação dos formandos", fonte: "DGERT · Portaria 851/2010 q)", hint: "Questionário de reacção no último dia.", obrigatorio: true },
  { id: "aval-formador", fase: "depois", label: "Avaliação de desempenho do formador", fonte: "DGERT · Portaria 851/2010 p)", hint: "Preenchida pelo coordenador pedagógico.", obrigatorio: true },
  { id: "certificados", fase: "depois", label: "Comprovativo de entrega dos certificados", fonte: "DGERT · s) · NetForce / SIGO", hint: "CCP emitido no Portal NetForce após pauta.", auto: "certificados", obrigatorio: true },
  { id: "relatorio", fase: "depois", label: "Relatório final da turma", fonte: "DGERT · Portaria 851/2010 t)", hint: "Fecha o DTP. Sem relatório a turma não se arquiva.", bloqueante: true, obrigatorio: true },
];

const FIN: DtpDef[] = [
  { id: "notificacao", fase: "antes", topico: 1, ordem: 1, label: "Notificação da decisão de aprovação da candidatura e respetivo termo de aceitação", fonte: "1. Enquadramento", hint: "Decisão de aprovação e termo de aceitação da candidatura.", obrigatorio: true },
  { id: "comunicacao-arranque", fase: "antes", topico: 1, ordem: 2, label: "Comunicação de arranque do projeto", fonte: "1. Enquadramento", hint: "Comunicação de arranque enviada ao financiador.", obrigatorio: true },
  { id: "cronograma", fase: "antes", topico: 1, ordem: 3, label: "Cronograma", fonte: "1. Enquadramento", hint: "Sai das sessões desta turma.", auto: "cronograma", obrigatorio: true },
  { id: "programa", fase: "antes", topico: 1, ordem: 4, label: "Programa", fonte: "1. Enquadramento", hint: "O GesForma gera o PDF do programa a partir da ficha da UFCD.", obrigatorio: true },
  { id: "regulamento", fase: "antes", topico: 1, ordem: 5, label: "Regulamento da atividade formativa", fonte: "1. Enquadramento", hint: "Regulamento da atividade.", obrigatorio: true },
  { id: "regulamento-formando", fase: "antes", topico: 1, ordem: 6, label: "Regulamento do formando", fonte: "1. Enquadramento", hint: "Regulamento entregue a cada formando.", obrigatorio: true },
  { id: "materiais", fase: "antes", topico: 2, ordem: 1, label: "Manuais e textos de apoio", fonte: "2. Recursos pedagógicos", hint: "Manuais e textos disponibilizados na ação.", obrigatorio: true },
  { id: "protocolo-espacos", fase: "antes", topico: 2, ordem: 2, label: "Protocolo de cedência de espaços", fonte: "2. Recursos pedagógicos", hint: "Protocolo do espaço onde a ação decorre.", obrigatorio: true },
  { id: "selecao-formadores", fase: "antes", topico: 3, ordem: 1, label: "Processo de seleção de formadores", fonte: "3. Formadores", hint: "Registo da seleção de quem lecciona.", obrigatorio: true },
  { id: "id-formador", fase: "antes", topico: 3, ordem: 2, label: "Documento de identificação", fonte: "3. Formadores", hint: "Documento de identificação do formador.", obrigatorio: true },
  { id: "habil-formador", fase: "antes", topico: 3, ordem: 3, label: "Certificado de habilitações", fonte: "3. Formadores", hint: "Certificado de habilitações do formador.", obrigatorio: true },
  { id: "cv-formador", fase: "antes", topico: 3, ordem: 4, label: "Curriculum vitae", fonte: "3. Formadores", hint: "Curriculum vitae do formador.", obrigatorio: true },
  { id: "ccp-formador", fase: "antes", topico: 3, ordem: 5, label: "CCP", fonte: "3. Formadores", hint: "Certificado de competências pedagógicas.", obrigatorio: true },
  { id: "ficha-dgert", fase: "antes", topico: 3, ordem: 6, label: "Ficha Curricular DGERT", fonte: "3. Formadores", hint: "Ficha curricular do formador.", obrigatorio: true },
  { id: "formacao-complementar", fase: "antes", topico: 3, ordem: 7, label: "Outros certificados de formação complementar", fonte: "3. Formadores", hint: "Formação complementar do formador, quando exista.", obrigatorio: true },
  { id: "contrato-formador", fase: "antes", topico: 3, ordem: 8, label: "Contrato de prestação de serviços", fonte: "3. Formadores", hint: "Contrato do formador desta ação.", obrigatorio: true },
  { id: "honorarios", fase: "antes", topico: 3, ordem: 9, label: "Nota de honorários e respetivo recibo", fonte: "3. Formadores", hint: "Nota de honorários e recibo do formador.", obrigatorio: true },
  { id: "equipa", fase: "antes", topico: 4, ordem: 1, label: "Listagem da equipa pedagógica", fonte: "4. Equipa técnica", hint: "O GesForma gera o PDF com o formador e a equipa registados nesta turma.", obrigatorio: true },
  { id: "selecao-formandos", fase: "antes", topico: 5, ordem: 1, label: "Processo de seleção dos formandos", fonte: "5. Formandos", hint: "Critérios e resultado da seleção.", obrigatorio: true },
  { id: "listagem-formandos", fase: "antes", topico: 5, ordem: 2, label: "Listagem de formandos", fonte: "5. Formandos", hint: "O GesForma gera o PDF com os formandos desta turma.", obrigatorio: true },
  { id: "fichas", fase: "antes", topico: 5, ordem: 3, label: "Ficha de inscrição dos formandos", fonte: "5. Formandos", hint: "O GesForma gera o PDF com os dados de inscrição de cada formando.", obrigatorio: true },
  { id: "rgpd-contratos", fase: "antes", topico: 5, ordem: 4, label: "Declaração RGPD + Contratos de formação", fonte: "5. Formandos", hint: "A ligação pessoal pede os dois. O visto fecha quando cada formando tem contrato e declaração.", auto: "doc-rgpd-contratos", obrigatorio: true },
  { id: "cc", fase: "antes", topico: 5, ordem: 5, label: "a) Cartão de cidadão", fonte: "5. Formandos", hint: "Um por formando da turma.", auto: "doc-cc", obrigatorio: true },
  { id: "ch", fase: "antes", topico: 5, ordem: 6, label: "b) Certificado de habilitações", fonte: "5. Formandos", hint: "Um por formando da turma.", auto: "doc-ch", obrigatorio: true },
  { id: "cv-formando", fase: "antes", topico: 5, ordem: 7, label: "Curriculum vitae", fonte: "5. Formandos", hint: "Pedido na ligação pessoal. O visto fecha quando o CV está na ficha de cada formando.", auto: "doc-cu", obrigatorio: true },
  { id: "entidade-patronal", fase: "antes", topico: 5, ordem: 8, label: "c) Declaração da entidade patronal", fonte: "5. Formandos", hint: "O GesForma conta o comprovativo de emprego de cada formando.", auto: "doc-ce", obrigatorio: true },
  { id: "morada", fase: "antes", topico: 5, ordem: 9, label: "d) Comprovativo de morada", fonte: "5. Formandos", hint: "Pedido na ligação pessoal. Um comprovativo por formando.", auto: "doc-morada", obrigatorio: true },
  { id: "iban", fase: "antes", topico: 5, ordem: 10, label: "e) IBAN nominativo", fonte: "5. Formandos", hint: "Sem IBAN nominativo não há pagamento de apoios.", auto: "doc-ci", bloqueante: true, obrigatorio: true },
  { id: "seguro-formandos", fase: "antes", topico: 5, ordem: 11, label: "Lista de formandos com seguro de acidentes pessoais (quando aplicável)", fonte: "5. Formandos", hint: "Quando o seguro não se aplica, marque o documento como no dossiê.", obrigatorio: true },
  { id: "mapa-pagamento", fase: "antes", topico: 5, ordem: 12, label: "Mapa de ordem de pagamento aos formandos (validado)", fonte: "5. Formandos", hint: "Mapa validado dos pagamentos aos formandos.", obrigatorio: true },
  { id: "presencas", fase: "durante", topico: 6, ordem: 1, label: "Folhas de presença", fonte: "6. Assiduidade", hint: "Uma folha por sessão realizada.", auto: "presencas", obrigatorio: true },
  { id: "planos", fase: "durante", topico: 6, ordem: 2, label: "Planos de sessão", fonte: "6. Assiduidade", hint: "Um plano por sessão do cronograma.", auto: "planos", obrigatorio: true },
  { id: "justificacao-faltas", fase: "durante", topico: 6, ordem: 3, label: "Folhas de justificação de faltas", fonte: "6. Assiduidade", hint: "Justificações de falta desta turma.", obrigatorio: true },
  { id: "ocorrencias", fase: "durante", topico: 6, ordem: 4, label: "Folhas de ocorrências", fonte: "6. Assiduidade", hint: "Ocorrências registadas nas sessões.", obrigatorio: true },
  { id: "reclamacao", fase: "durante", topico: 6, ordem: 5, label: "Folha de reclamação", fonte: "6. Assiduidade", hint: "Folha de reclamação da ação. Se não houve reclamação, marque como no dossiê.", obrigatorio: true },
  { id: "teste-diagnostico", fase: "durante", topico: 7, ordem: 1, label: "Teste de diagnóstico (oral ou escrito)", fonte: "7. Avaliação da aprendizagem", hint: "Diagnóstico aplicado no início da ação.", obrigatorio: true },
  { id: "teste-final", fase: "durante", topico: 7, ordem: 2, label: "Teste de avaliação final", fonte: "7. Avaliação da aprendizagem", hint: "Enunciado da avaliação final.", obrigatorio: true },
  { id: "corrigenda", fase: "durante", topico: 7, ordem: 3, label: "Corrigenda do teste de avaliação final", fonte: "7. Avaliação da aprendizagem", hint: "Corrigenda do teste final.", obrigatorio: true },
  { id: "grelha-correcao", fase: "durante", topico: 7, ordem: 4, label: "Grelha de correção do teste de avaliação final - assinada pelo formador", fonte: "7. Avaliação da aprendizagem", hint: "Grelha assinada pelo formador.", obrigatorio: true },
  { id: "pauta", fase: "depois", topico: 7, ordem: 5, label: "Pauta de avaliação final - assinada pelo formador", fonte: "7. Avaliação da aprendizagem", hint: "O GesForma gera a pauta a partir da grelha desta turma. A nota do Moodle continua a lançar-se à mão.", obrigatorio: true },
  { id: "inquerito-formador", fase: "depois", topico: 8, ordem: 1, label: "Inquéritos de avaliação do formador", fonte: "8. Avaliação da ação", hint: "Perguntas dos inquéritos com público-alvo Formador enviados a esta turma.", auto: "inqueritos-formador", obrigatorio: true },
  { id: "inquerito-formandos", fase: "depois", topico: 8, ordem: 2, label: "Inquéritos de avaliação dos formandos", fonte: "8. Avaliação da ação", hint: "Perguntas dos inquéritos com público-alvo Formandos enviados a esta turma.", auto: "inqueritos-formandos", obrigatorio: true },
  { id: "diagnostico-necessidades", fase: "depois", topico: 8, ordem: 3, label: "Diagnóstico necessidades de formação", fonte: "8. Avaliação da ação", hint: "Diagnóstico de necessidades associado à ação.", obrigatorio: true },
  { id: "relatorios-estatisticos", fase: "depois", topico: 8, ordem: 4, label: "Relatórios estatísticos", fonte: "8. Avaliação da ação", hint: "O GesForma gera as médias e as contagens das respostas de avaliação desta turma.", obrigatorio: true },
  { id: "relatorio", fase: "depois", topico: 8, ordem: 5, label: "Relatório final da ação", fonte: "8. Avaliação da ação", hint: "O GesForma gera o PDF com os dados desta turma.", bloqueante: true, obrigatorio: true },
  { id: "relatorio-inicial", fase: "durante", topico: 9, ordem: 1, label: "Relatório inicial", fonte: "9. Supervisão", hint: "Relatório inicial de supervisão.", obrigatorio: true },
  { id: "relatorio-intermedio", fase: "durante", topico: 9, ordem: 2, label: "Relatório intermédio", fonte: "9. Supervisão", hint: "Relatório intermédio de supervisão.", obrigatorio: true },
  { id: "relatorio-supervisao", fase: "depois", topico: 9, ordem: 3, label: "Relatório final", fonte: "9. Supervisão", hint: "Relatório final de supervisão e apoio pedagógico.", obrigatorio: true },
  { id: "folheto", fase: "antes", topico: 10, ordem: 1, label: "Folheto de divulgação da ação", fonte: "10. Divulgação", hint: "Folheto usado na divulgação desta ação.", obrigatorio: true },
  { id: "certificados", fase: "depois", topico: 11, ordem: 1, label: "Cópia dos certificados emitidos", fonte: "11. Certificados", hint: "O certificado legal obtém-se fora do GesForma. O visto fecha quando cada formando elegível com aproveitamento tem o PDF carregado.", auto: "certificados", obrigatorio: true },
  { id: "entrega-certificados", fase: "depois", topico: 11, ordem: 2, label: "Comprovativo da entrega dos certificados", fonte: "11. Certificados", hint: "O GesForma gera a lista de quem já tem o certificado externo no dossiê.", obrigatorio: true },
  { id: "equidade", fase: "antes", topico: 12, ordem: 1, label: "Checklist de igualdade de oportunidades", fonte: "12. Equidade", hint: "Checklist preenchida para esta ação.", obrigatorio: true },
  { id: "academia", fase: "antes", topico: 13, ordem: 1, label: "Reporte retirado do Portal Academia Portugal Digital", fonte: "13. Academia Digital", hint: "Reporte da turma no Portal Academia Portugal Digital.", obrigatorio: true },
  { id: "inqueritos-pos", fase: "depois", topico: 14, ordem: 1, label: "Inquéritos pós-formação", fonte: "14. Impacto pós-formação", hint: "Perguntas dos inquéritos com público-alvo Pós-formação enviados a esta turma.", auto: "inqueritos-pos", obrigatorio: true },
  { id: "relatorio-pos", fase: "depois", topico: 14, ordem: 2, label: "Relatório pós-formação", fonte: "14. Impacto pós-formação", hint: "O GesForma gera o relatório só com as respostas de pós-formação desta turma.", obrigatorio: true },
];

const UNIVERSAL_IDS = new Set(GOLD.map(d => d.id).filter(id => FIN.some(f => f.id === id)));

export function dtpUniversal(id: string) {
  return UNIVERSAL_IDS.has(id);
}

export function dtpDefs(regime: "gold" | "fin") {
  return (regime === "gold" ? GOLD : FIN).map(d => ({ ...d, universal: UNIVERSAL_IDS.has(d.id) }));
}

export type CursoFicheiroRef = {
  ambito: string;
  requisitoId: string;
  pessoaId: number | null;
  pessoaNome: string;
};

/** O visto no dossiê só fecha quando todas as partes associadas ao requisito entregaram. */
export function estadoPorFicheirosCurso(
  requisitoId: string,
  files: CursoFicheiroRef[],
  formandos: { id: number }[],
  formadorNome: string,
): { estado: DtpEstado; detalhe: string } | null {
  const grupo = files.filter(f => f.requisitoId === requisitoId);
  if (!grupo.length) return null;
  const ambitos = new Set(grupo.map(f => f.ambito));
  const partes: DtpEstado[] = [];
  const notas: string[] = [];
  if (ambitos.has("curso")) {
    const n = grupo.filter(f => f.ambito === "curso").length;
    partes.push(n > 0 ? "ok" : "falta");
    notas.push(n > 0 ? "ficheiro do curso" : "falta o ficheiro do curso");
  }
  if (ambitos.has("formando")) {
    const ids = new Set(grupo.filter(f => f.ambito === "formando" && f.pessoaId != null).map(f => f.pessoaId));
    const total = formandos.length;
    const done = formandos.filter(f => ids.has(f.id)).length;
    partes.push(total > 0 && done >= total ? "ok" : done > 0 ? "parcial" : "falta");
    notas.push(total > 0 ? `${done}/${total} formandos` : "sem formandos na turma");
  }
  if (ambitos.has("formador")) {
    const nome = formadorNome.trim().toLowerCase();
    const hit = Boolean(nome) && grupo.some(f => f.ambito === "formador" && f.pessoaNome.trim().toLowerCase() === nome);
    partes.push(hit ? "ok" : "falta");
    notas.push(hit ? "formador entregue" : "falta o formador da turma");
  }
  if (!partes.length) return null;
  const estado: DtpEstado = partes.every(p => p === "ok")
    ? "ok"
    : partes.some(p => p === "ok" || p === "parcial")
      ? "parcial"
      : "falta";
  return { estado, detalhe: notas.join(" · ") };
}

export type DtpCounts = { done: number; total: number };

export type DtpFacts = {
  sessoes: DtpCounts;
  planos: DtpCounts;
  sumarios: DtpCounts;
  presencas: DtpCounts;
  formandos: number;
  certificados: DtpCounts;
  contratos: DtpCounts;
  pip: DtpCounts | null;
  simInicial: DtpCounts | null;
  simFinal: DtpCounts | null;
  docs: Record<string, DtpCounts>;
  inqueritosFormador?: DtpCounts | null;
  inqueritosFormandos?: DtpCounts | null;
  inqueritosPos?: DtpCounts | null;
};

function estadoFromCounts(c: DtpCounts | null | undefined): { estado: DtpEstado; detalhe: string } | null {
  if (!c || c.total <= 0) return null;
  if (c.done >= c.total) return { estado: "ok", detalhe: `${c.done}/${c.total} no dossiê.` };
  if (c.done > 0) return { estado: "parcial", detalhe: `${c.done}/${c.total} no dossiê.` };
  return { estado: "falta", detalhe: `0/${c.total} no dossiê.` };
}

function factFor(auto: DtpAuto, facts: DtpFacts): DtpCounts | null {
  switch (auto) {
    case "cronograma": return facts.sessoes.total > 0 ? { done: 1, total: 1 } : { done: 0, total: 1 };
    case "planos": return facts.planos;
    case "sumarios": return facts.sumarios;
    case "presencas": return facts.presencas;
    case "certificados": return facts.certificados;
    case "contratos": return facts.contratos;
    case "pip": return facts.pip;
    case "sim-ini": return facts.simInicial;
    case "sim-fim": return facts.simFinal;
    case "inqueritos-formador": return facts.inqueritosFormador ?? null;
    case "inqueritos-formandos": return facts.inqueritosFormandos ?? null;
    case "inqueritos-pos": return facts.inqueritosPos ?? null;
    default: return facts.docs[auto.replace(/^doc-/, "")] ?? null;
  }
}

export type DtpItem = DtpDef & {
  estado: DtpEstado;
  detalhe: string;
  origem: "auto" | "manual";
  extra?: boolean;
  ambito?: DtpAmbito;
  universal?: boolean;
  anexo?: { fileName: string; url: string; driveFileId: string } | null;
  /** Contagem do percurso público de inscrição, só em Gold. */
  percurso?: DtpPercurso;
};

export type DtpPercurso = {
  submetidos: number;
  validados: number;
  recusados: number;
  total: number;
};

/** Tipo do documento no percurso público, quando o item do dossiê Gold corresponde a um. */
export function tipoPercursoDoItem(item: { id: string; auto?: string; ambito?: string }): string | null {
  if (item.auto === "contratos") return "contrato";
  if (item.auto === "doc-regulamento") return "regulamento";
  if (item.auto === "doc-exp") return "exp";
  if (item.id === "recibos") return "comprovativo";
  if (item.id.startsWith("extra:") && item.ambito === "formando") return item.id.slice("extra:".length);
  return null;
}

function detalhePercurso(p: DtpPercurso) {
  const partes: string[] = [];
  if (p.submetidos) partes.push(`${p.submetidos} ${p.submetidos === 1 ? "submetido" : "submetidos"}`);
  if (p.validados) partes.push(`${p.validados} ${p.validados === 1 ? "validado" : "validados"} pela secretaria`);
  if (p.recusados) partes.push(`${p.recusados} ${p.recusados === 1 ? "recusado" : "recusados"}`);
  const emFalta = p.total - p.submetidos - p.validados - p.recusados;
  if (emFalta > 0 && (p.submetidos || p.validados || p.recusados)) partes.push(`${emFalta} em falta`);
  return partes.join(" · ");
}

/**
 * Em Gold, um ficheiro do percurso só conta como no dossiê depois de a secretaria validar.
 * Submetido (pendente) fica parcial. A marcação manual da turma mantém-se.
 */
export function aplicarPercursoNoItem(item: DtpItem, percurso: DtpPercurso, manual: boolean): DtpItem {
  const com = { ...item, percurso };
  if (manual || percurso.total <= 0) return com;
  const chegou = percurso.submetidos + percurso.validados + percurso.recusados;
  if (chegou <= 0) return com;
  const detalhe = detalhePercurso(percurso);
  if (percurso.validados === percurso.total) {
    return { ...com, estado: "ok", detalhe, origem: "auto" };
  }
  if (percurso.submetidos + percurso.validados > 0) {
    return { ...com, estado: "parcial", detalhe, origem: "auto" };
  }
  return { ...com, estado: "falta", detalhe, origem: "auto" };
}

/** Estrutura do dossiê de um curso: base do regime menos o que foi retirado, mais os extras. */
export function dtpEstrutura(regime: "gold" | "fin", modelo: DtpModelo = DTP_MODELO_VAZIO): DtpDef[] {
  // Na financiada o dossiê é o mesmo para todas as UFCD.
  const efectivo = regime === "fin" ? DTP_MODELO_VAZIO : modelo;
  const fora = new Set(efectivo.excluidos);
  const base = dtpDefs(regime).filter(def => def.obrigatorio || !fora.has(def.id));
  const extras: DtpDef[] = efectivo.extra.filter(x => x.id && !fora.has(x.id) && !fora.has(`extra:${x.id}`)).map(x => ({
    ...x,
    id: `extra:${x.id}`,
    auto: x.ambito === "formando" || x.ambito === "formador" ? (`doc-${x.id}` as DtpAuto) : undefined,
  }));
  const faseOrdem: Record<DtpFase, number> = { antes: 0, durante: 1, depois: 2 };
  return [...base, ...extras].sort((a, b) => (a.topico ?? 99) - (b.topico ?? 99) || (a.ordem ?? 0) - (b.ordem ?? 0) || faseOrdem[a.fase] - faseOrdem[b.fase]);
}

export function buildDtpItems(
  regime: "gold" | "fin",
  facts: DtpFacts,
  manual: Record<string, DtpEstado>,
  modelo: DtpModelo = DTP_MODELO_VAZIO,
): DtpItem[] {
  return dtpEstrutura(regime, modelo).map(def => {
    const extra = def.id.startsWith("extra:");
    const override = manual[def.id];
    const universal = dtpUniversal(def.id);
    if (override) {
      return { ...def, estado: override, detalhe: def.hint, origem: "manual" as const, extra, ambito: def.ambito, universal };
    }
    if (def.auto === "certificados") {
      const certs = factFor("certificados", facts);
      if (!certs || certs.total <= 0) {
        const detalhe = facts.formandos > 0
          ? `Ainda sem formandos elegíveis com aproveitamento. ${def.hint}`
          : `Ainda sem formandos nesta turma. ${def.hint}`;
        return { ...def, estado: "falta" as const, detalhe, origem: "auto" as const, extra, ambito: def.ambito, universal };
      }
    }
    const derived = def.auto ? estadoFromCounts(factFor(def.auto, facts)) : null;
    if (derived) {
      return { ...def, estado: derived.estado, detalhe: `${derived.detalhe} ${def.hint}`.trim(), origem: "auto" as const, extra, ambito: def.ambito, universal };
    }
    return { ...def, estado: "falta" as DtpEstado, detalhe: def.hint, origem: "manual" as const, extra, ambito: def.ambito, universal };
  });
}

export function dtpPct(items: { estado: DtpEstado }[]) {
  if (!items.length) return 0;
  const ok = items.filter(i => i.estado === "ok").length;
  const parcial = items.filter(i => i.estado === "parcial").length;
  return Math.round(((ok + parcial * 0.5) / items.length) * 100);
}
