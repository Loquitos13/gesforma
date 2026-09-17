export type DtpFase = "antes" | "durante" | "depois";
export type DtpEstado = "ok" | "parcial" | "falta";

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
  | "doc-exp"
  | "doc-regulamento";

export type DtpDef = {
  id: string;
  fase: DtpFase;
  label: string;
  fonte: string;
  hint: string;
  auto?: DtpAuto;
  bloqueante?: boolean;
  /** Norma legal: fica no dossiê de todos os cursos do regime e não se pode remover. */
  obrigatorio?: boolean;
};

/** Documento acrescentado por um curso concreto, além da estrutura base do regime. */
export type DtpExtraDef = {
  id: string;
  fase: DtpFase;
  label: string;
  fonte: string;
  hint: string;
  bloqueante?: boolean;
};

/** Modelo do dossiê de um curso: o que se retira da base e o que se acrescenta. */
export type DtpModelo = {
  excluidos: string[];
  extra: DtpExtraDef[];
};

export const DTP_MODELO_VAZIO: DtpModelo = { excluidos: [], extra: [] };

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
  { id: "id-turma", fase: "antes", label: "Identificação da turma", fonte: "DGERT · Portaria 851/2010", hint: "Código interno, UFCD, carga horária e regime.", obrigatorio: true },
  { id: "ufcd", fase: "antes", label: "Referencial / código UFCD", fonte: "Financiada · Catálogo SNQ", hint: "Código e designação oficial da UFCD.", obrigatorio: true },
  { id: "programa", fase: "antes", label: "Programa de formação", fonte: "DGERT · Portaria 851/2010 a)", hint: "Objetivos, conteúdos, metodologias, avaliação e recursos.", obrigatorio: true },
  { id: "regulamento", fase: "antes", label: "Regulamento de formação", fonte: "DGERT · Portaria 851/2010", hint: "Regulamento ENA + regras do programa financiador.", obrigatorio: true },
  { id: "enquadramento", fase: "antes", label: "Enquadramento / documentação do financiador", fonte: "Programa de financiamento", hint: "Candidatura, despacho ou regras da tipologia." },
  { id: "instalacoes", fase: "antes", label: "Locais, recursos e infraestruturas", fonte: "Despacho 5756/2020 h)", hint: "Salas, plataforma e equipamentos.", obrigatorio: true },
  { id: "divulgacao", fase: "antes", label: "Divulgação da turma", fonte: "DGERT · Portaria 851/2010 aa)", hint: "Canais onde a turma foi divulgada.", obrigatorio: true },
  { id: "fichas", fase: "antes", label: "Fichas de inscrição e requisitos de acesso", fonte: "DGERT · f) · programa", hint: "Ficha e elegibilidade de cada candidato.", obrigatorio: true },
  { id: "cc", fase: "antes", label: "Cartão de cidadão (documentos do formando)", fonte: "Financiada · elegibilidade", hint: "Um por formando da turma.", auto: "doc-cc" },
  { id: "ch", fase: "antes", label: "Certificado de habilitações", fonte: "Financiada · elegibilidade", hint: "Um por formando da turma.", auto: "doc-ch" },
  { id: "cv-formando", fase: "antes", label: "Curriculum vitae do formando", fonte: "Financiada · elegibilidade", hint: "Um por formando da turma.", auto: "doc-cu" },
  { id: "iban", fase: "antes", label: "IBAN / comprovativo de NIB", fonte: "Financiada · processamento", hint: "Sem IBAN não há pagamento de apoios.", auto: "doc-ci", bloqueante: true },
  { id: "emprego", fase: "antes", label: "Comprovativo de situação perante o emprego", fonte: "Financiada · IEFP / tipologia", hint: "Um por formando da turma.", auto: "doc-ce" },
  { id: "contratos-f", fase: "antes", label: "Contratos de formação (formandos)", fonte: "DGERT · Portaria 851/2010 i)", hint: "A turma fica bloqueada até estarem completos.", obrigatorio: true },
  { id: "contrato-formador", fase: "antes", label: "Contrato do formador", fonte: "DGERT · Portaria 851/2010 i)", hint: "Contrato do formador da UFCD.", obrigatorio: true },
  { id: "cv-formador", fase: "antes", label: "CV do formador", fonte: "DGERT / IEFP", hint: "CV actualizado no perfil do formador.", obrigatorio: true },
  { id: "ccp-formador", fase: "antes", label: "CCP / CCPE do formador", fonte: "DGERT · requisitos do formador", hint: "Certificado válido.", obrigatorio: true },
  { id: "rgpd", fase: "antes", label: "Autorizações RGPD / dados digitais", fonte: "RGPD · e-learning", hint: "Aceites no momento da inscrição." },
  { id: "cronograma", fase: "antes", label: "Cronograma / plano semanal", fonte: "Despacho 5756/2020 g)", hint: "Sessões síncronas e trabalho assíncrono.", auto: "cronograma", obrigatorio: true },
  { id: "planos", fase: "antes", label: "Planos de sessão", fonte: "DGERT · Portaria 851/2010 j)", hint: "Um plano por sessão do cronograma.", auto: "planos", obrigatorio: true },
  { id: "sumarios", fase: "durante", label: "Sumários (presencial, síncrona e assíncrona)", fonte: "Despacho 5756/2020 e) f)", hint: "Em e-learning o sumário assíncrono também conta.", auto: "sumarios", bloqueante: true, obrigatorio: true },
  { id: "presencas", fase: "durante", label: "Presenças por sessão + participação online", fonte: "DGERT l) · Despacho 5756/2020 e) f)", hint: "Assiduidade em percentagem e em horas.", auto: "presencas", obrigatorio: true },
  { id: "horas", fase: "durante", label: "Mapa de assiduidade em horas (carga UFCD)", fonte: "Financiada · execução", hint: "O financiador pede horas, não só percentagem de sessões.", bloqueante: true, obrigatorio: true },
  { id: "instrumentos", fase: "durante", label: "Instrumentos de avaliação + enunciados", fonte: "DGERT · Portaria 851/2010 m) n)", hint: "Testes e grelhas usados na avaliação.", obrigatorio: true },
  { id: "ocorrencias", fase: "durante", label: "Registo de ocorrências", fonte: "DGERT · Portaria 851/2010 r)", hint: "Desistências e alterações de calendário.", obrigatorio: true },
  { id: "materiais", fase: "durante", label: "Manuais e textos de apoio", fonte: "Despacho 5756/2020 o)", hint: "Materiais disponibilizados na plataforma.", obrigatorio: true },
  { id: "pauta", fase: "depois", label: "Pauta, classificações e ata de avaliação", fonte: "Despacho 5756/2020 k)", hint: "Classificação de cada formando.", obrigatorio: true },
  { id: "satisfacao", fase: "depois", label: "Avaliação de reação (formandos, formador, coordenador)", fonte: "Despacho 5756/2020 l)", hint: "Questionários no fecho da turma.", obrigatorio: true },
  { id: "certificados", fase: "depois", label: "Certificados / registo SIGO", fonte: "DGERT · s) · SNQ", hint: "UFCD certificada via SIGO após pauta e assiduidade.", auto: "certificados", obrigatorio: true },
  { id: "execucao", fase: "depois", label: "Relatório de execução da turma", fonte: "Financiada · Despacho 5756/2020 j)", hint: "Horas, formandos, desistências e execução financeira.", obrigatorio: true },
  { id: "relatorio", fase: "depois", label: "Relatório final da turma", fonte: "DGERT · Portaria 851/2010 t)", hint: "Fecha o DTP pedagógico.", bloqueante: true, obrigatorio: true },
];

export function dtpDefs(regime: "gold" | "fin") {
  return regime === "gold" ? GOLD : FIN;
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
    default: return facts.docs[auto.replace(/^doc-/, "")] ?? null;
  }
}

export type DtpItem = DtpDef & { estado: DtpEstado; detalhe: string; origem: "auto" | "manual"; extra?: boolean };

/** Estrutura do dossiê de um curso: base do regime menos o que foi retirado, mais os extras. */
export function dtpEstrutura(regime: "gold" | "fin", modelo: DtpModelo = DTP_MODELO_VAZIO): DtpDef[] {
  const fora = new Set(modelo.excluidos);
  const base = dtpDefs(regime).filter(def => def.obrigatorio || !fora.has(def.id));
  const extras: DtpDef[] = modelo.extra.map(x => ({ ...x, id: `extra:${x.id}` }));
  const ordem: Record<DtpFase, number> = { antes: 0, durante: 1, depois: 2 };
  return [...base, ...extras].sort((a, b) => ordem[a.fase] - ordem[b.fase]);
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
    if (override) {
      return { ...def, estado: override, detalhe: def.hint, origem: "manual" as const, extra };
    }
    const derived = def.auto ? estadoFromCounts(factFor(def.auto, facts)) : null;
    if (derived) {
      return { ...def, estado: derived.estado, detalhe: `${derived.detalhe} ${def.hint}`.trim(), origem: "auto" as const, extra };
    }
    return { ...def, estado: "falta" as DtpEstado, detalhe: def.hint, origem: "manual" as const, extra };
  });
}

export function dtpPct(items: { estado: DtpEstado }[]) {
  if (!items.length) return 0;
  const ok = items.filter(i => i.estado === "ok").length;
  const parcial = items.filter(i => i.estado === "parcial").length;
  return Math.round(((ok + parcial * 0.5) / items.length) * 100);
}
