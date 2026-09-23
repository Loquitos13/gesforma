export type LeadStage =
  | "Nova"
  | "Contacto Inicial"
  | "Reunião / Diagnóstico"
  | "Proposta Enviada"
  | "Ganho"
  | "Perdido";

export type Lead = {
  id: string;
  nome: string;
  apelido: string;
  email: string;
  telefone: string;
  cursoInteresse: string;
  regime: "Gold" | "Financiada";
  valorPrevisto: number;
  etapa: LeadStage;
  probabilidade: number;
  origem: "Website" | "Campanha Meta" | "Google Ads" | "Referência" | "Parceiro" | "Telefone" | "LinkedIn";
  responsavel: string;
  parceiroId?: string;
  parceiroNome?: string;
  dataCriacao: string;
  ultimoContacto: string;
  proximoContacto?: string;
  notasCount: number;
  observacoes?: string;
};

export type NotaTipo =
  | "Chamada"
  | "Reunião"
  | "Email"
  | "Proposta"
  | "Negociação"
  | "WhatsApp"
  | "Visita";

export type NotaComercial = {
  id: string;
  tipo: NotaTipo;
  titulo: string;
  conteudo: string;
  leadId?: string;
  leadNome?: string;
  parceiroId?: string;
  parceiroNome?: string;
  autor: string;
  dataRegisto: string;
  temFollowUp: boolean;
  dataFollowUp?: string;
  followUpConcluido?: boolean;
  prioridade: "Alta" | "Média" | "Baixa";
};

export type TipoParceria =
  | "Protocolo de Estágio"
  | "Empresa Cliente"
  | "Entidade Formadora"
  | "Agente Comercial"
  | "Instituição de Ensino"
  | "Associação Setorial";

export type Parceiro = {
  id: string;
  nomeEntidade: string;
  nif: string;
  tipo: TipoParceria;
  contactoNome: string;
  contactoCargo: string;
  contactoEmail: string;
  contactoTelefone: string;
  cidade: string;
  morada?: string;
  website?: string;
  protocoloDataInicio: string;
  protocoloValidade: string;
  condicoesComerciais: string;
  estado: "Ativo" | "Em Negociação" | "Inativo";
  totalAlunosEncaminhados: number;
  totalTurmasEnvolvidas: number;
  notasCount: number;
};

export const CRM_LEAD_STAGES: LeadStage[] = [
  "Nova",
  "Contacto Inicial",
  "Reunião / Diagnóstico",
  "Proposta Enviada",
  "Ganho",
  "Perdido",
];

export const INITIAL_LEADS: Lead[] = [
  {
    id: "LEAD-101",
    nome: "Sofia",
    apelido: "Gonçalves Lima",
    email: "sofia.lima@clinicasaude.pt",
    telefone: "912 345 678",
    cursoInteresse: "Curso de Auxiliar de Medicina Dentária",
    regime: "Gold",
    valorPrevisto: 300,
    etapa: "Proposta Enviada",
    probabilidade: 80,
    origem: "Website",
    responsavel: "Carlos Aguilar",
    parceiroId: "PARC-01",
    parceiroNome: "Clínica Dentária Sorriso Modelo",
    dataCriacao: "2026-09-12 10:15",
    ultimoContacto: "2026-09-22 15:30",
    proximoContacto: "2026-09-25 10:00",
    notasCount: 3,
    observacoes: "Interesse em inscrever 3 colaboradoras da clínica. Solicitou condições para grupo.",
  },
  {
    id: "LEAD-102",
    nome: "Marco",
    apelido: "Aurélio Ferreira",
    email: "marco.ferreira@gestaonorte.com",
    telefone: "934 887 112",
    cursoInteresse: "Formação de Formadores - CCP",
    regime: "Gold",
    valorPrevisto: 125,
    etapa: "Reunião / Diagnóstico",
    probabilidade: 60,
    origem: "LinkedIn",
    responsavel: "Carlos Aguilar",
    dataCriacao: "2026-09-15 14:20",
    ultimoContacto: "2026-09-21 11:00",
    proximoContacto: "2026-09-24 16:30",
    notasCount: 2,
    observacoes: "Necessita de obter CCP com urgência para assumir módulos internos na empresa.",
  },
  {
    id: "LEAD-103",
    nome: "Beatriz",
    apelido: "Carvalho Costa",
    email: "beatriz.costa@techsol.pt",
    telefone: "967 554 990",
    cursoInteresse: "Publicidade nas Redes Sociais: Master em Tráfego",
    regime: "Financiada",
    valorPrevisto: 0,
    etapa: "Nova",
    probabilidade: 30,
    origem: "Campanha Meta",
    responsavel: "Mariana Costa",
    dataCriacao: "2026-09-23 09:10",
    ultimoContacto: "2026-09-23 09:10",
    proximoContacto: "2026-09-24 11:00",
    notasCount: 1,
    observacoes: "Inscrição online submetida. Confirmar habilitações e situação profissional.",
  },
  {
    id: "LEAD-104",
    nome: "Ricardo",
    apelido: "Simões Meireles",
    email: "ricardo.meireles@me.com",
    telefone: "926 771 445",
    cursoInteresse: "Excel do Básico ao Avançado",
    regime: "Gold",
    valorPrevisto: 45,
    etapa: "Contacto Inicial",
    probabilidade: 40,
    origem: "Google Ads",
    responsavel: "Mariana Costa",
    dataCriacao: "2026-09-18 16:45",
    ultimoContacto: "2026-09-20 14:00",
    proximoContacto: "2026-09-26 15:00",
    notasCount: 1,
    observacoes: "Pretende horário pós-laboral ou e-learning flexível.",
  },
  {
    id: "LEAD-105",
    nome: "Daniela",
    apelido: "Vaz Rodrigues",
    email: "daniela.rodrigues@hospitalveterinario.pt",
    telefone: "919 002 331",
    cursoInteresse: "Curso de Auxiliar de Medicina Veterinária",
    regime: "Gold",
    valorPrevisto: 400,
    etapa: "Ganho",
    probabilidade: 100,
    origem: "Referência",
    responsavel: "Carlos Aguilar",
    parceiroId: "PARC-02",
    parceiroNome: "Hospital Veterinário Douro Sul",
    dataCriacao: "2026-09-02 11:30",
    ultimoContacto: "2026-09-19 17:00",
    notasCount: 4,
    observacoes: "Inscrição confirmada e pagamento efetuado. Encaminhada para a turma de outubro.",
  },
  {
    id: "LEAD-106",
    nome: "Hugo",
    apelido: "Miguel Parente",
    email: "hugo.parente@consultores.pt",
    telefone: "931 442 889",
    cursoInteresse: "Métodos e Técnicas Pedagógicas Ativos",
    regime: "Financiada",
    valorPrevisto: 0,
    etapa: "Contacto Inicial",
    probabilidade: 45,
    origem: "Website",
    responsavel: "Mariana Costa",
    dataCriacao: "2026-09-19 18:20",
    ultimoContacto: "2026-09-22 10:15",
    proximoContacto: "2026-09-25 14:30",
    notasCount: 2,
    observacoes: "Pediu programa detalhado por email. Aguarda parecer da chefia.",
  },
  {
    id: "LEAD-107",
    nome: "Patrícia",
    apelido: "Nunes Antunes",
    email: "patricia.antunes@globalcorp.com",
    telefone: "963 881 224",
    cursoInteresse: "A Arte de Comunicar e Falar em Público: B-learning",
    regime: "Gold",
    valorPrevisto: 80,
    etapa: "Perdido",
    probabilidade: 0,
    origem: "Campanha Meta",
    responsavel: "Carlos Aguilar",
    dataCriacao: "2026-08-25 15:00",
    ultimoContacto: "2026-09-10 16:30",
    notasCount: 3,
    observacoes: "Desistiu por incompatibilidade horária com a atividade laboral atual.",
  },
  {
    id: "LEAD-108",
    nome: "Gonçalo",
    apelido: "Filipe Tavares",
    email: "goncalo.tavares@industriasantos.pt",
    telefone: "914 992 556",
    cursoInteresse: "CCP - Formação de Formadores para Empresas",
    regime: "Gold",
    valorPrevisto: 120,
    etapa: "Proposta Enviada",
    probabilidade: 75,
    origem: "Parceiro",
    responsavel: "Carlos Aguilar",
    parceiroId: "PARC-03",
    parceiroNome: "Associação Comercial e Industrial do Porto",
    dataCriacao: "2026-09-14 09:30",
    ultimoContacto: "2026-09-22 16:45",
    proximoContacto: "2026-09-26 11:30",
    notasCount: 3,
    observacoes: "Proposta comercial enviada para formação fechada de 8 formadores internos.",
  },
];

export const INITIAL_NOTAS: NotaComercial[] = [
  {
    id: "NOT-201",
    tipo: "Proposta",
    titulo: "Envio de proposta para formação em grupo de Medicina Dentária",
    conteudo: "Enviada cotação formal para 3 formandas com desconto de parceiro de 10%. Aguarda validação pela administração da clínica até sexta-feira.",
    leadId: "LEAD-101",
    leadNome: "Sofia Gonçalves Lima",
    parceiroId: "PARC-01",
    parceiroNome: "Clínica Dentária Sorriso Modelo",
    autor: "Carlos Aguilar",
    dataRegisto: "2026-09-22 15:30",
    temFollowUp: true,
    dataFollowUp: "2026-09-25 10:00",
    followUpConcluido: false,
    prioridade: "Alta",
  },
  {
    id: "NOT-202",
    tipo: "Reunião",
    titulo: "Reunião online de diagnóstico de necessidades CCP",
    conteudo: "Alinhadas expectativas sobre o percurso formativo. Candidato tem disponibilidade aos sábados de manhã na turma de Vila Nova de Gaia.",
    leadId: "LEAD-102",
    leadNome: "Marco Aurélio Ferreira",
    autor: "Carlos Aguilar",
    dataRegisto: "2026-09-21 11:00",
    temFollowUp: true,
    dataFollowUp: "2026-09-24 16:30",
    followUpConcluido: false,
    prioridade: "Média",
  },
  {
    id: "NOT-203",
    tipo: "Chamada",
    titulo: "Primeiro contacto telefónico de acolhimento",
    conteudo: "Contacto de boas-vindas após registo no website. Explicados os pré-requisitos de elegibilidade e documentação necessária.",
    leadId: "LEAD-103",
    leadNome: "Beatriz Carvalho Costa",
    autor: "Mariana Costa",
    dataRegisto: "2026-09-23 09:10",
    temFollowUp: true,
    dataFollowUp: "2026-09-24 11:00",
    followUpConcluido: false,
    prioridade: "Média",
  },
  {
    id: "NOT-204",
    tipo: "Negociação",
    titulo: "Negociação do protocolo de acolhimento de formandos em estágio",
    conteudo: "Reunião com a direção de recursos humanos. Acordado protocolo para receção de 6 formandos de Medicina Veterinária por ano com tutor interno.",
    parceiroId: "PARC-02",
    parceiroNome: "Hospital Veterinário Douro Sul",
    autor: "Carlos Aguilar",
    dataRegisto: "2026-09-19 16:00",
    temFollowUp: false,
    followUpConcluido: true,
    prioridade: "Alta",
  },
  {
    id: "NOT-205",
    tipo: "Email",
    titulo: "Envio de cronograma detalhado de Excel Avançado",
    conteudo: "Enviado descritivo dos módulos e exercícios práticos em folha de cálculo. Candidato solicitou esclarecimento sobre certificado DGERT.",
    leadId: "LEAD-104",
    leadNome: "Ricardo Simões Meireles",
    autor: "Mariana Costa",
    dataRegisto: "2026-09-20 14:00",
    temFollowUp: true,
    dataFollowUp: "2026-09-26 15:00",
    followUpConcluido: false,
    prioridade: "Baixa",
  },
  {
    id: "NOT-206",
    tipo: "Proposta",
    titulo: "Apresentação da proposta formativa institucional para associados",
    conteudo: "Apresentada minuta de protocolo com 15% de benefício para empresas associadas da ACIP na frequência de formações executivas e CCP.",
    parceiroId: "PARC-03",
    parceiroNome: "Associação Comercial e Industrial do Porto",
    leadId: "LEAD-108",
    leadNome: "Gonçalo Filipe Tavares",
    autor: "Carlos Aguilar",
    dataRegisto: "2026-09-22 16:45",
    temFollowUp: true,
    dataFollowUp: "2026-09-26 11:30",
    followUpConcluido: false,
    prioridade: "Alta",
  },
  {
    id: "NOT-207",
    tipo: "WhatsApp",
    titulo: "Envio de dados de pagamento e confirmação de vaga",
    conteudo: "Partilhadas referências de Multibanco e MB Way. Candidata respondeu com comprovativo de transferência imediata.",
    leadId: "LEAD-105",
    leadNome: "Daniela Vaz Rodrigues",
    autor: "Carlos Aguilar",
    dataRegisto: "2026-09-19 17:00",
    temFollowUp: false,
    followUpConcluido: true,
    prioridade: "Média",
  },
];

export const INITIAL_PARCEIROS: Parceiro[] = [
  {
    id: "PARC-01",
    nomeEntidade: "Clínica Dentária Sorriso Modelo",
    nif: "509 881 234",
    tipo: "Protocolo de Estágio",
    contactoNome: "Dr. António Brandão",
    contactoCargo: "Diretor Clínico",
    contactoEmail: "direcao@sorrisomodelo.pt",
    contactoTelefone: "223 710 440",
    cidade: "Vila Nova de Gaia",
    morada: "Avenida da República, 1420",
    website: "https://sorrisomodelo.pt",
    protocoloDataInicio: "2025-01-15",
    protocoloValidade: "2027-01-14",
    condicoesComerciais: "Desconto de 10% para equipa interna; acolhimento de 4 estagiárias por ciclo",
    estado: "Ativo",
    totalAlunosEncaminhados: 12,
    totalTurmasEnvolvidas: 5,
    notasCount: 6,
  },
  {
    id: "PARC-02",
    nomeEntidade: "Hospital Veterinário Douro Sul",
    nif: "510 442 890",
    tipo: "Empresa Cliente",
    contactoNome: "Dra. Teresa Loureiro",
    contactoCargo: "Responsável de Recursos Humanos",
    contactoEmail: "rh@veterinariodouro.pt",
    contactoTelefone: "220 994 311",
    cidade: "Porto",
    morada: "Rua de Gonçalo Cristóvão, 310",
    website: "https://veterinariodouro.pt",
    protocoloDataInicio: "2024-06-01",
    protocoloValidade: "2026-12-31",
    condicoesComerciais: "Estágios curriculares regulares; 15% de comissão em inscrições recomendadas",
    estado: "Ativo",
    totalAlunosEncaminhados: 18,
    totalTurmasEnvolvidas: 8,
    notasCount: 9,
  },
  {
    id: "PARC-03",
    nomeEntidade: "Associação Comercial e Industrial do Porto",
    nif: "501 334 112",
    tipo: "Associação Setorial",
    contactoNome: "Eng. Miguel Castro",
    contactoCargo: "Gestor de Parcerias Institucionais",
    contactoEmail: "parcerias@acporto.pt",
    contactoTelefone: "222 001 500",
    cidade: "Porto",
    morada: "Palácio da Bolsa, Rua de Ferreira Borges",
    website: "https://acporto.pt",
    protocoloDataInicio: "2025-09-01",
    protocoloValidade: "2027-08-31",
    condicoesComerciais: "Divulgação conjunta de ações de formação; desconto institucional de 15% para associados",
    estado: "Ativo",
    totalAlunosEncaminhados: 34,
    totalTurmasEnvolvidas: 14,
    notasCount: 11,
  },
  {
    id: "PARC-04",
    nomeEntidade: "Instituto Superior Politécnico da Maia",
    nif: "504 991 772",
    tipo: "Instituição de Ensino",
    contactoNome: "Prof. Doutora Helena Matos",
    contactoCargo: "Coordenadora de Saídas Profissionais",
    contactoEmail: "hmatos@ismai.pt",
    contactoTelefone: "229 866 000",
    cidade: "Maia",
    morada: "Avenida Central da Maia, 4470",
    website: "https://ismai.pt",
    protocoloDataInicio: "2024-10-01",
    protocoloValidade: "2026-09-30",
    condicoesComerciais: "Créditos formativos e encaminhamento de licenciados para certificação pedagógica CCP",
    estado: "Ativo",
    totalAlunosEncaminhados: 29,
    totalTurmasEnvolvidas: 11,
    notasCount: 7,
  },
  {
    id: "PARC-05",
    nomeEntidade: "TalentLink Recursos Humanos",
    nif: "512 887 334",
    tipo: "Agente Comercial",
    contactoNome: "Bruno Valadares",
    contactoCargo: "Consultor Sénior de Recrutamento",
    contactoEmail: "bruno@talentlink.pt",
    contactoTelefone: "915 220 889",
    cidade: "Lisboa",
    morada: "Avenida da Liberdade, 245",
    website: "https://talentlink.pt",
    protocoloDataInicio: "2026-03-01",
    protocoloValidade: "2027-02-28",
    condicoesComerciais: "Comissão de 12% por formando angariado para formações executivas Gold",
    estado: "Em Negociação",
    totalAlunosEncaminhados: 6,
    totalTurmasEnvolvidas: 3,
    notasCount: 4,
  },
  {
    id: "PARC-06",
    nomeEntidade: "Grupo Hoteleiro Lusitano",
    nif: "508 119 443",
    tipo: "Empresa Cliente",
    contactoNome: "Carla Pires Mendes",
    contactoCargo: "Diretora de Formação Corporativa",
    contactoEmail: "formacao@hotelarialusitana.pt",
    contactoTelefone: "228 331 900",
    cidade: "Braga",
    morada: "Largo do Toural, 88",
    website: "https://hotelarialusitana.pt",
    protocoloDataInicio: "2023-05-10",
    protocoloValidade: "2025-05-09",
    condicoesComerciais: "Formação contínua de colaboradores em Primeiros Socorros e Higiene no Trabalho",
    estado: "Inativo",
    totalAlunosEncaminhados: 42,
    totalTurmasEnvolvidas: 6,
    notasCount: 5,
  },
];
