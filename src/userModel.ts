export type UserRole =
  | "Administrador"
  | "Secretaria"
  | "Comercial CRM"
  | "Coordenador Pedagógico"
  | "Operador";

export type SystemUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  cargo: string;
  telefone: string;
  active: boolean;
  ultimoAcesso: string;
  criadoEm: string;
  permissoes: string[];
};

export type PermissionItem = {
  id: string;
  label: string;
  descricao: string;
};

export type PermissionGroup = {
  id: string;
  categoria: string;
  descricao: string;
  permissoes: PermissionItem[];
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "painel",
    categoria: "Painel e Indicadores",
    descricao: "Acesso à visão geral da entidade, métricas e alertas da secretaria.",
    permissoes: [
      { id: "painel.view", label: "Consultar Painel", descricao: "Visualizar resumo executivo e tarefas a fazer" },
      { id: "painel.metricas", label: "Métricas Financeiras", descricao: "Ver totais de faturação, pagamentos e receitas" },
    ],
  },
  {
    id: "gold",
    categoria: "Formação Gold (Particular)",
    descricao: "Gestão operacional de cursos particulares, pré-inscrições e formandos Gold.",
    permissoes: [
      { id: "gold.preinscricoes", label: "Pré-Inscrições Gold", descricao: "Gerir leads, contactos e conversões em formandos" },
      { id: "gold.formandos", label: "Formandos e Pagamentos", descricao: "Aceder a fichas individuais e confirmação de pagamento" },
      { id: "gold.turmas", label: "Turmas e Cronogramas", descricao: "Criar turmas, editar horários e gerir cockpits" },
      { id: "gold.cursos", label: "Catálogo de Cursos Gold", descricao: "Editar fichas técnicas, módulos e preços comerciais" },
      { id: "gold.dtp", label: "Dossiê TP Gold", descricao: "Gerir arquivo pedagógico, relatórios e certificados" },
      { id: "gold.inqueritos", label: "Inquéritos de Satisfação Gold", descricao: "Consultar e analisar respostas dos formandos" },
    ],
  },
  {
    id: "financiada",
    categoria: "Formação Financiada",
    descricao: "Acompanhamento de UFCD, elegibilidade documental e auditoria.",
    permissoes: [
      { id: "fin.inscricoes", label: "Inscrições Financiadas", descricao: "Triagem inicial de candidaturas e critérios de acesso" },
      { id: "fin.formandos", label: "Conferência Documental", descricao: "Validar CC, Certificado Habilitações, CU e Comprovativos" },
      { id: "fin.turmas", label: "Turmas e UFCD Financiadas", descricao: "Montagem de turmas, calendarização e vagas" },
      { id: "fin.presencas", label: "Presenças e Sumários", descricao: "Registo de assiduidade e assinatura de sumários" },
      { id: "fin.dtp", label: "Dossiê TP Financiada", descricao: "Conformidade DGERT, POISE e exportação de dossiers" },
      { id: "fin.inqueritos", label: "Inquéritos Financiada", descricao: "Resultados da avaliação da formação financiada" },
    ],
  },
  {
    id: "crm",
    categoria: "CRM Comercial e Parcerias",
    descricao: "Gestão de leads comerciais, notas de contacto e entidades parceiras.",
    permissoes: [
      { id: "crm.leads.view", label: "Consultar Leads e Pipeline", descricao: "Acesso à lista e funil de vendas de potenciais formandos" },
      { id: "crm.leads.manage", label: "Criar e Editar Leads", descricao: "Inserir leads, qualificar e avançar etapas no funil" },
      { id: "crm.notas.manage", label: "Notas Comerciais e Follow-ups", descricao: "Registar chamadas, reuniões e lembretes de contacto" },
      { id: "crm.parceiros.manage", label: "Gestão de Parceiros", descricao: "Gerir empresas, protocolos de estágio e acordos comerciais" },
      { id: "crm.export", label: "Exportação de Dados CRM", descricao: "Exportar listagens de contactos comerciais e relatórios" },
    ],
  },
  {
    id: "formadores",
    categoria: "Bolsa de Formadores",
    descricao: "Base de formadores, especialidades, contratos e alocações.",
    permissoes: [
      { id: "formadores.view", label: "Consultar Bolsa de Formadores", descricao: "Visualizar perfis, CCP, especialidades e contactos" },
      { id: "formadores.manage", label: "Adicionar e Editar Formadores", descricao: "Atualizar dados contratuais, regimes e atribuições a turmas" },
    ],
  },
  {
    id: "comunicacao",
    categoria: "Comunicação e Conteúdos",
    descricao: "Automatismos de correio eletrónico, modelos de email e portal de notícias.",
    permissoes: [
      { id: "emails.manage", label: "Emails Automáticos", descricao: "Gerir regras, gatilhos, modelos XML e envios" },
      { id: "blog.manage", label: "Gestão do Blog", descricao: "Criar e publicar artigos e temáticas de divulgação" },
    ],
  },
  {
    id: "sistema",
    categoria: "Administração e Sistema",
    descricao: "Parametrização global, segurança de acessos e controlo financeiro.",
    permissoes: [
      { id: "pagamentos.manage", label: "Gestão de Pagamentos", descricao: "Acompanhar transações, recibos e conciliação bancária" },
      { id: "users.manage", label: "Gestão de Utilizadores", descricao: "Criar utilizadores, definir perfis e permissões de acesso" },
      { id: "config.manage", label: "Configurações da Entidade", descricao: "Editar dados institucionais, acreditação DGERT e IEFP" },
    ],
  },
];

export const ALL_PERMISSION_IDS: string[] = PERMISSION_GROUPS.flatMap(g =>
  g.permissoes.map(p => p.id),
);

export const ROLE_PERMISSION_PRESETS: Record<UserRole, string[]> = {
  Administrador: [...ALL_PERMISSION_IDS],
  Secretaria: [
    "painel.view",
    "gold.preinscricoes",
    "gold.formandos",
    "gold.turmas",
    "gold.cursos",
    "gold.dtp",
    "gold.inqueritos",
    "fin.inscricoes",
    "fin.formandos",
    "fin.turmas",
    "fin.presencas",
    "fin.dtp",
    "fin.inqueritos",
    "crm.leads.view",
    "crm.notas.manage",
    "formadores.view",
    "emails.manage",
    "pagamentos.manage",
  ],
  "Comercial CRM": [
    "painel.view",
    "crm.leads.view",
    "crm.leads.manage",
    "crm.notas.manage",
    "crm.parceiros.manage",
    "crm.export",
    "gold.preinscricoes",
    "gold.cursos",
  ],
  "Coordenador Pedagógico": [
    "painel.view",
    "gold.turmas",
    "gold.cursos",
    "gold.dtp",
    "gold.inqueritos",
    "fin.turmas",
    "fin.presencas",
    "fin.dtp",
    "fin.inqueritos",
    "formadores.view",
    "formadores.manage",
  ],
  Operador: [
    "painel.view",
    "crm.leads.view",
    "crm.notas.manage",
    "gold.preinscricoes",
    "fin.inscricoes",
  ],
};

export const INITIAL_USERS: SystemUser[] = [
  {
    id: "USR-001",
    name: "Tânia Santos",
    email: "tania@ena.pt",
    role: "Administrador",
    cargo: "Diretora de Operações e Administração",
    telefone: "914 011 998",
    active: true,
    ultimoAcesso: "Hoje, 09:42",
    criadoEm: "2024-01-10",
    permissoes: [...ALL_PERMISSION_IDS],
  },
  {
    id: "USR-002",
    name: "Carlos Aguilar",
    email: "aguilar@ena.pt",
    role: "Comercial CRM",
    cargo: "Responsável de Admissões e Parcerias",
    telefone: "919 700 594",
    active: true,
    ultimoAcesso: "Hoje, 10:15",
    criadoEm: "2024-03-01",
    permissoes: [...ROLE_PERMISSION_PRESETS["Comercial CRM"]],
  },
  {
    id: "USR-003",
    name: "Marta Secretariado",
    email: "secretaria@ena.pt",
    role: "Secretaria",
    cargo: "Técnica de Secretariado e Apoio ao Aluno",
    telefone: "914 304 801",
    active: true,
    ultimoAcesso: "Ontem, 18:20",
    criadoEm: "2024-02-15",
    permissoes: [...ROLE_PERMISSION_PRESETS["Secretaria"]],
  },
  {
    id: "USR-004",
    name: "Isac Silva",
    email: "isac.silva@ena.pt",
    role: "Coordenador Pedagógico",
    cargo: "Coordenador Pedagógico e Formador CCP",
    telefone: "914 547 554",
    active: true,
    ultimoAcesso: "21/09/2026",
    criadoEm: "2024-01-20",
    permissoes: [...ROLE_PERMISSION_PRESETS["Coordenador Pedagógico"]],
  },
  {
    id: "USR-005",
    name: "Mariana Costa",
    email: "mariana.costa@ena.pt",
    role: "Comercial CRM",
    cargo: "Gestora de Leads e Atendimento Comercial",
    telefone: "932 874 093",
    active: true,
    ultimoAcesso: "Hoje, 08:50",
    criadoEm: "2025-05-12",
    permissoes: [...ROLE_PERMISSION_PRESETS["Comercial CRM"]],
  },
  {
    id: "USR-006",
    name: "Rui Pedagógico",
    email: "rui.pedagogico@ena.pt",
    role: "Operador",
    cargo: "Assistente de Apoio às Turmas",
    telefone: "925 997 151",
    active: false,
    ultimoAcesso: "14/08/2026",
    criadoEm: "2025-01-18",
    permissoes: [...ROLE_PERMISSION_PRESETS["Operador"]],
  },
];
