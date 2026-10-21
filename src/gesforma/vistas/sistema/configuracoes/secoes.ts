// Campos de cada definição. As chaves são as que o servidor lê (server/src/regrasConfig.ts, lembretePre.ts);
// as secções Formação, Gold e Financiada guardam notas internas da entidade com as chaves de sempre.
import type { CampoDefinicao } from "./SeccaoDefinicoes";
import { CAMPOS_CANDIDATURA_FIN } from "../../../../partilhado/candidaturaFin";

export const CAMPOS_ENTIDADE: CampoDefinicao[] = [
  { chave: "nome", rotulo: "Designação", largo: true },
  { chave: "nomeCurto", rotulo: "Nome curto" },
  { chave: "nif", rotulo: "NIF", ajuda: "9 dígitos." },
  { chave: "certificacaoDgert", rotulo: "Certificação DGERT" },
  { chave: "site", rotulo: "Site" },
  { chave: "morada", rotulo: "Morada", largo: true },
  { chave: "codigoPostal", rotulo: "Código postal" },
  { chave: "localidade", rotulo: "Localidade" },
  { chave: "email", rotulo: "Email", tipo: "email" },
  { chave: "telefone", rotulo: "Telefone" },
  { chave: "telefonesZona", rotulo: "Telefones por zona (reserva dos emails)", tipo: "linhas", largo: true, ajuda: "Os emails usam os contactos de cada local (Edição de Cursos › Locais). Estes só aparecem se nenhum local tiver contactos. Um por linha." },
  { chave: "iban", rotulo: "IBAN para transferências", ajuda: "Aparece no pedido de pagamento e no passo de pagamento da ligação pessoal." },
  { chave: "titularConta", rotulo: "Titular da conta" },
];

export const CAMPOS_REGRAS: CampoDefinicao[] = [
  { chave: "assiduidadeMinGold", rotulo: "Assiduidade mínima · Gold", tipo: "pct", ajuda: "Para aproveitamento e certificado." },
  { chave: "assiduidadeMinFin", rotulo: "Assiduidade mínima · Financiada", tipo: "pct", ajuda: "Em horas da UFCD." },
  { chave: "elearningMin", rotulo: "Resultado mínimo no e-learning", tipo: "pct", ajuda: "Quando o curso não tem grelha de notas." },
  { chave: "justificadasContam", rotulo: "As faltas justificadas contam como presença", tipo: "bool" },
  { chave: "fechoExigeSessoes", rotulo: "O fecho da turma exige sumários assinados e presenças validadas", tipo: "bool" },
  { chave: "fechoExigeNotas", rotulo: "O fecho da turma exige a nota final de todos os formandos activos", tipo: "bool" },
  { chave: "dtpBloqueiaFecho", rotulo: "O Dossiê TP incompleto bloqueia o fecho da turma", tipo: "bool" },
  { chave: "dtpBloqueiaCertificado", rotulo: "O Dossiê TP incompleto bloqueia a emissão de certificados", tipo: "bool" },
];

export const CAMPOS_LEMBRETE: CampoDefinicao[] = [
  { chave: "activo", rotulo: "Enviar o lembrete da pré-inscrição", tipo: "bool", ajuda: "Enquanto faltarem documentos, turma ou pagamento, a pessoa recebe um email com a ligação no passo que falta." },
  { chave: "quantidade", rotulo: "De quanto em quanto tempo", tipo: "numero", placeholder: "1" },
  {
    chave: "unidade", rotulo: "Unidade", tipo: "escolha",
    opcoes: [{ valor: "minutos", rotulo: "Minutos" }, { valor: "horas", rotulo: "Horas" }, { valor: "dias", rotulo: "Dias" }],
    ajuda: "Os lembretes só saem na volta diária (07:00 UTC, ≈ 08:00 em Lisboa no verão): um intervalo de minutos ou horas equivale, na prática, a um dia.",
  },
  { chave: "maximo", rotulo: "Máximo de lembretes por pré-inscrição", tipo: "numero", placeholder: "5", ajuda: "Depois deste número deixa de enviar." },
];

export const CAMPOS_FORMACAO: CampoDefinicao[] = [
  { chave: "Arquivo DTP", rotulo: "Arquivo do Dossiê TP", placeholder: "Ex.: 10 anos" },
  { chave: "Certificados", rotulo: "Emissão de certificados", placeholder: "Ex.: SIGO" },
  { chave: "Unidade de gestão", rotulo: "Unidade de gestão", placeholder: "Ex.: Turma" },
  { chave: "Língua dos documentos", rotulo: "Língua dos documentos", placeholder: "Ex.: Português" },
];

export const CAMPOS_GOLD: CampoDefinicao[] = [
  { chave: "Curso-bandeira", rotulo: "Curso-bandeira" },
  { chave: "DTP", rotulo: "Conteúdo do Dossiê TP", largo: true },
];

export const CAMPOS_FIN: CampoDefinicao[] = [
  { chave: "Documentos", rotulo: "Documentos pedidos", largo: true },
  { chave: "Assiduidade", rotulo: "Regra de assiduidade" },
  { chave: "Turma sem documentos", rotulo: "Turma sem documentos" },
  { chave: "Financiador", rotulo: "Financiador habitual" },
];

/** Candidatura da Financiada: sai na ficha de inscrição e na folha de presenças / sumário (Configurações › Financiada). */
export const CAMPOS_CANDIDATURA: CampoDefinicao[] = CAMPOS_CANDIDATURA_FIN.map(c => ({ chave: c.chave, rotulo: c.rotulo, largo: true }));
