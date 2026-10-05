import { beginViewLoad, endViewLoad, isSilentViewPath } from "./viewLoadingBus";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) || "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type StaffRole = "admin" | "secretaria" | "comercial" | "financiada";
export type SessionUser = { id: string; email: string; name: string; role: StaffRole | string };

export type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  created_at: string;
  last_login_at: string | null;
  sessions_open: number;
};

export type EmailRule = {
  id: number;
  nome: string;
  gatilho: string;
  template: string;
  atraso: string;
  curso: string | null;
  ativo: boolean;
  envios: number;
  taxaAbertura: number;
};

export type EmailTemplate = {
  id: number;
  tipo: string;
  nome: string;
  assunto: string;
  body_lines?: string[] | string;
  body_xml?: string;
  cta?: string;
  cta_href?: string;
  cta_ambito?: "preinscricao" | "contacto" | "documentos" | "pagamento";
  updated_at: string;
};

export type OpsSnapshot = {
  preinscricoes: Array<{
    id: number; inscrito: string; nome: string; apelido: string; email: string; telf: string;
    inicioCurso: string; concelho: string; local: string; curso: string; preco: number;
    estado: string; campanha: string; origem: string; horario?: string; turmaId?: number; entrada?: "preinscricao" | "manual";
    meioContacto?: string; etiquetaId?: number | null; etiquetaNome?: string; etiquetaCor?: string;
    contactadoEm: string | null; notas: string;
    comercialId?: string | null; comercialNome?: string;
    nif?: string; moradaFiscal?: string; codigoPostal?: string;
    motivoDesistencia?: string; pagamentoMetodo?: string;
    secretariaEm?: string | null;
    ultimaNota?: string; ultimaActividadeEm?: string | null; ultimaResultado?: string;
  }>;
  formandosTurmas: Array<{
    id: number; nome: string; apelido: string; telf: string; email: string; inscrito: string;
    local: string; curso: string; turma: string; turmaId: number; estado: string;
    pago: boolean; valor: number; metodo: string;
  }>;
  formandosFin: Array<{
    id: number; nome: string; apelido: string; turma: string; telf: string; email: string;
    curso: string; estado: string;
    cc: { ok: boolean; data: string }; ch: { ok: boolean; data: string };
    cu: { ok: boolean; data: string }; ci: { ok: boolean; data: string }; ce: { ok: boolean; data: string };
  }>;
  cursosGold: Array<{ id: number; nome: string; categoria: string; tipo: string; preco: number; regime: string; horas: number; estado: string; entidadeResponsavelId?: number | null }>;
  cursosFin: Array<{ id: number; ufcdCod: string; ufcd: string; nomeComercial: string; regime: string; horas: number; estado: string }>;
  turmasGold: Array<{
    id: number; dataInicio: string; nome: string; curso: string; local: string; horario: string;
    totalAlunos: number; vagas: number; inscricoesAdicionais?: number; estado: string; formador: string; horas: number; cronograma: unknown[];
  }>;
  turmasFin: Array<{
    id: number; dataInicio: string; nome: string; curso: string; ufcdCod: string; local: string; horario: string;
    alunos: number; alunosTotal: number; inscricoesAdicionais?: number; estado: string; horas: number; formador: string; activa: boolean; cronograma: unknown[];
  }>;
  formadores: Array<{
    id: number; nome: string; telf: string; email: string; especialidade: string; ccp: string; nif: string;
    regimes: string[]; estado: string; disponibilidade?: unknown;
  }>;
  campanhas: Array<{
    id: number; nome: string; data: string; encarregado: string; curso?: string;
    preinscricoes: number; pagos: number; receita: number; custo: number;
    fim?: string; canal?: string; notas?: string;
  }>;
  blogPosts: Array<{ id: number; titulo: string; slug: string; data: string; status: string }>;
  pagamentos: Array<{ id: string; nome: string; valor: number; metodo: string; curso: string; data: string; estado: string; email?: string; referencia?: string }>;
  catalogs?: Record<string, Array<Record<string, unknown> & { id: number }>>;
  settings?: Record<string, Record<string, string>>;
};

export type EmailJob = {
  id: string;
  to_email: string;
  to_name: string;
  subject: string;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  last_error: string | null;
  regra: string;
};

export type EmailJobStats = { sent: number; queued: number; failed: number };

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Gesforma-Client", "web");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const method = (init.method ?? "GET").toUpperCase();
  const track = !isSilentViewPath(path);
  if (track) beginViewLoad();
  try {
    const res = await fetch(`${BASE}${path}`, { ...init, credentials: "include", headers });
    if (res.status === 204) return undefined as T;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : "pedido recusado");
    return data as T;
  } finally {
    if (track) endViewLoad();
  }
}

export type DriveStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  folderName: string;
  folderId: string | null;
  mode: "google" | "local";
  hint: string;
  redirectUri?: string;
  loginRedirectUri?: string;
  clientId?: string;
  hasSecret?: boolean;
  fromEnv?: boolean;
};

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  webViewLink: string | null;
  openUrl: string;
  folderPath: string;
  kind: string;
  regime: string | null;
  turma: string | null;
  formando: string | null;
  label: string | null;
  storedIn: "google" | "local";
  createdAt: string;
};

export type DriveUploadContext = {
  kind: string;
  regime?: "gold" | "fin";
  turma?: string;
  formando?: string;
  label?: string;
  fase?: string;
  itemId?: string;
};

export const apiHealth = () => api<{ ok: boolean; driver: string; mail: string; drive?: boolean }>("/health");
export const apiMe = () => api<{ user: SessionUser }>("/v1/me");
export const apiLogin = (email: string, password: string) =>
  api<{ user: SessionUser }>("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const apiLogout = () => api<{ ok: boolean }>("/v1/auth/logout", { method: "POST" });
export const apiUsers = () => api<{ users: StaffUser[] }>("/v1/users");
export const apiCreateUser = (body: { name: string; email: string; password: string; role: StaffRole; active?: boolean }) =>
  api<{ user: StaffUser }>("/v1/users", { method: "POST", body: JSON.stringify(body) });
export const apiPatchUser = (id: string, body: { name?: string; email?: string; role?: StaffRole; active?: boolean }) =>
  api<{ user: StaffUser }>(`/v1/users/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiSetUserPassword = (id: string, password: string, revokeSessions = true) =>
  api<{ ok: boolean }>(`/v1/users/${id}/password`, { method: "POST", body: JSON.stringify({ password, revokeSessions }) });
export const apiDeleteUser = (id: string) => api<{ ok: boolean }>(`/v1/users/${id}`, { method: "DELETE" });

export type EquipaStats = {
  leads: number;
  porContactar: number;
  emConversa: number;
  pagos: number;
  conversao: number;
  propostas: number;
  propostasAceites: number;
  propostasRecusadas: number;
  pipeline: number;
  receita: number;
};

export type EquipaComercial = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  lastLoginAt: string | null;
  stats: EquipaStats;
};

export type EquipaProposta = {
  id: number;
  comercialId: string;
  preinscricaoId: number | null;
  clienteNome: string;
  clienteEmail: string;
  curso: string;
  valor: number;
  estado: string;
  respostaCliente: string;
  respostaEm: string | null;
  enviadaEm: string | null;
  notas: string;
};

export type EquipaNota = {
  id: number;
  preinscricaoId: number;
  leadNome: string;
  leadCurso: string;
  nota: string;
  createdAt: string | null;
};

export const apiEquipa = (regime: "gold" | "fin" = "gold") => api<{
  totais: { comerciais: number; activos: number; leads: number; propostas: number; pipeline: number; receita: number };
  comerciais: EquipaComercial[];
}>(`/v1/equipa?regime=${regime}`);

export const apiEquipaFicha = (id: string, regime: "gold" | "fin" = "gold") => api<{
  comercial: EquipaComercial;
  propostas: EquipaProposta[];
  leads: OpsSnapshot["preinscricoes"];
  notas: EquipaNota[];
}>(`/v1/equipa/${id}?regime=${regime}`);

export const apiEquipaProposta = (comercialId: string, body: {
  clienteNome: string; clienteEmail?: string; curso?: string; valor?: number;
  estado?: "Enviada" | "Negociação" | "Aceite" | "Recusada" | "Expirada";
  respostaCliente?: string; notas?: string; preinscricaoId?: number | null;
  regime?: "gold" | "fin";
}) => api<{ proposta: EquipaProposta }>(`/v1/equipa/${comercialId}/propostas`, { method: "POST", body: JSON.stringify(body) });

export const apiPatchProposta = (id: number, body: {
  estado?: string; respostaCliente?: string; valor?: number; notas?: string; curso?: string;
}) => api<{ proposta: EquipaProposta }>(`/v1/equipa/propostas/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const apiEquipaNota = (comercialId: string, body: { preinscricaoId: number; nota: string }) =>
  api<{ ok: boolean }>(`/v1/equipa/${comercialId}/notas`, { method: "POST", body: JSON.stringify(body) });


export type Regime = "gold" | "fin";
export type DtpEstado = "ok" | "parcial" | "falta";

export type DtpItem = {
  id: string;
  fase: "antes" | "durante" | "depois";
  label: string;
  fonte: string;
  hint: string;
  estado: DtpEstado;
  detalhe: string;
  origem: "auto" | "manual";
  universal?: boolean;
  bloqueante?: boolean;
  obrigatorio?: boolean;
  /** Documento acrescentado na ficha do curso, fora da base do regime. */
  extra?: boolean;
  ambito?: DtpAmbito;
  anexo?: { fileName: string; url: string; driveFileId: string } | null;
  /** Ficheiros do percurso público: submetido ainda não é validado pela secretaria. */
  percurso?: { submetidos: number; validados: number; recusados: number; total: number };
};

export type DtpSnapshot = {
  items: DtpItem[];
  pct: number;
  ok: number;
  parcial: number;
  falta: number;
  total: number;
  /** Nome da entidade responsável cuja estrutura este dossiê usa. */
  entidade?: string | null;
  facts: {
    sessoes: { done: number; total: number };
    planos: { done: number; total: number };
    sumarios: { done: number; total: number };
    presencas: { done: number; total: number };
    formandos: number;
    certificados: { done: number; total: number };
  };
};

export type SessaoPedagogica = {
  n: number;
  plano: Record<string, unknown> | null;
  sumario: Record<string, unknown> | null;
  presencas: { id: number; nome: string; presente: boolean }[];
};

export type TurmaDocumento = {
  grupoId: string;
  label: string;
  estado: DtpEstado;
  detalhe: string;
  payload: unknown;
};

export type TurmaCertificado = {
  formandoId: number;
  emitido: boolean;
  nota: number | null;
  elearning: number | null;
};

export type PedagogiaSnapshot = {
  sessoes: SessaoPedagogica[];
  documentos: TurmaDocumento[];
  certificados: TurmaCertificado[];
  dtp: DtpSnapshot;
};

export const apiPedagogia = (regime: Regime, turmaId: number) =>
  api<PedagogiaSnapshot>(`/v1/turmas/${regime}/${turmaId}/pedagogia`);
export const apiSaveSessao = (
  regime: Regime,
  turmaId: number,
  n: number,
  body: { plano?: unknown; sumario?: unknown; presencas?: unknown },
) => api<{ sessao: SessaoPedagogica }>(`/v1/turmas/${regime}/${turmaId}/sessoes/${n}`, { method: "PUT", body: JSON.stringify(body) });
export const apiSaveTurmaDocumento = (regime: Regime, turmaId: number, body: TurmaDocumento) =>
  api<{ ok: boolean }>(`/v1/turmas/${regime}/${turmaId}/documentos`, { method: "PUT", body: JSON.stringify(body) });
export const apiSaveDtpItem = (regime: Regime, turmaId: number, itemId: string, estado: DtpEstado | "auto") =>
  api<{ dtp: DtpSnapshot }>(`/v1/turmas/${regime}/${turmaId}/dtp/${itemId}`, { method: "PUT", body: JSON.stringify({ estado }) });
export const apiArquivarDtpPdfs = (regime: Regime, turmaId: number) =>
  api<{ ok: boolean; dtp: DtpSnapshot }>(`/v1/turmas/${regime}/${turmaId}/dtp/pdfs`, { method: "POST" });
export const apiSaveDtpAnexo = (
  regime: Regime,
  turmaId: number,
  itemId: string,
  body: { driveFileId: string; fileName: string; driveUrl?: string },
) =>
  api<{ dtp: DtpSnapshot }>(`/v1/turmas/${regime}/${turmaId}/dtp/${itemId}/anexo`, { method: "PUT", body: JSON.stringify(body) });
export const apiSaveCertificado = (
  regime: Regime,
  turmaId: number,
  formandoId: number,
  body: { emitido?: boolean; nota?: number | null; elearning?: number | null },
) => api<{ ok: boolean }>(`/v1/turmas/${regime}/${turmaId}/certificados/${formandoId}`, { method: "PUT", body: JSON.stringify(body) });

export type NotaAvaliacaoApi = { formandoId: number; moduloId: string; parametroId: string; nota: number | null };
export const apiTurmaAvaliacao = (regime: Regime, turmaId: number) =>
  api<{ notas: NotaAvaliacaoApi[] }>(`/v1/turmas/${regime}/${turmaId}/avaliacao`);
export const apiSaveTurmaAvaliacao = (regime: Regime, turmaId: number, notas: NotaAvaliacaoApi[]) =>
  api<{ ok: boolean }>(`/v1/turmas/${regime}/${turmaId}/avaliacao`, { method: "PUT", body: JSON.stringify({ notas }) });
export const apiDtpResumo = (regime: Regime) => api<{ pct: Record<string, number> }>(`/v1/dtp/${regime}`);

export type DtpFase = "antes" | "durante" | "depois";
export type DtpDef = {
  id: string;
  fase: DtpFase;
  label: string;
  fonte: string;
  hint: string;
  bloqueante?: boolean;
  obrigatorio?: boolean;
  universal?: boolean;
};
export type DtpAmbito = "turma" | "formando" | "formador";
export type DtpExtra = {
  id?: string;
  fase: DtpFase;
  label: string;
  fonte?: string;
  hint?: string;
  bloqueante?: boolean;
  ambito?: DtpAmbito;
};
export type DtpModelo = {
  excluidos: string[];
  incluidos?: string[];
  extra: { id: string; fase: DtpFase; label: string; fonte: string; hint: string; bloqueante?: boolean; ambito?: DtpAmbito }[];
};
export type DtpEntidadeRef = { id: number; nome: string; modelo: DtpModelo };
export type DtpModeloResposta = {
  fases: { id: DtpFase; label: string; hint: string }[];
  base: DtpDef[];
  modelo: DtpModelo;
  entidade: DtpEntidadeRef | null;
  efectivo?: DtpModelo;
  estrutura: DtpDef[];
};
export type DtpEntidade = { id: number; nome: string; documentos: number };
export const apiDtpEntidades = () => api<{ entidades: DtpEntidade[] }>("/v1/dtp/gold/entidades");
export const apiCreateDtpEntidade = (nome: string) =>
  api<{ entidade: DtpEntidade }>("/v1/dtp/gold/entidades", { method: "POST", body: JSON.stringify({ nome }) });
export const apiRenameDtpEntidade = (id: number, nome: string) =>
  api<{ entidade: DtpEntidade }>(`/v1/dtp/gold/entidades/${id}`, { method: "PATCH", body: JSON.stringify({ nome }) });
export const apiDeleteDtpEntidade = (id: number) =>
  api<{ ok: boolean }>(`/v1/dtp/gold/entidades/${id}`, { method: "DELETE" });
export const apiDtpEntidadeModelo = (id: number) =>
  api<DtpModeloResposta>(`/v1/dtp/gold/entidades/${id}/modelo`);
export const apiSaveDtpEntidadeModelo = (id: number, body: { excluidos: string[]; extra: DtpExtra[] }) =>
  api<Pick<DtpModeloResposta, "modelo" | "estrutura">>(`/v1/dtp/gold/entidades/${id}/modelo`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
export const apiDtpModelo = (regime: Regime, cursoId: number) =>
  api<DtpModeloResposta>(`/v1/cursos/${regime}/${cursoId}/dtp-modelo`);
export const apiSaveDtpModelo = (regime: Regime, cursoId: number, body: { excluidos: string[]; incluidos?: string[]; extra: DtpExtra[] }) =>
  api<DtpModeloResposta>(`/v1/cursos/${regime}/${cursoId}/dtp-modelo`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export type CursoDocumentoFicheiro = {
  id: string;
  ambito: "curso" | "formando" | "formador" | string;
  requisitoId: string;
  pessoaId: number | null;
  pessoaNome: string;
  nome: string;
  url: string;
  createdAt: string;
};
export type CursoDocumentosResposta = {
  fases: { id: DtpFase; label: string; hint: string }[];
  requisitos: { id: string; fase: DtpFase; label: string; universal?: boolean }[];
  formandos: { id: number; nome: string }[];
  formadores: { id: number | null; nome: string }[];
  ficheiros: CursoDocumentoFicheiro[];
};
export const apiCursoDocumentos = (regime: Regime, cursoId: number) =>
  api<CursoDocumentosResposta>(`/v1/cursos/${regime}/${cursoId}/documentos`);
export async function apiCursoDocumentoUpload(
  regime: Regime,
  cursoId: number,
  file: File,
  ctx: { ambito: string; requisitoId: string; pessoaId?: number; pessoaNome?: string },
) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("ambito", ctx.ambito);
  fd.append("requisitoId", ctx.requisitoId);
  if (ctx.pessoaId != null) fd.append("pessoaId", String(ctx.pessoaId));
  if (ctx.pessoaNome) fd.append("pessoaNome", ctx.pessoaNome);
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("X-Gesforma-Client", "web");
  const res = await fetch(`${BASE}/v1/cursos/${regime}/${cursoId}/documentos`, {
    method: "POST", credentials: "include", headers, body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : "upload recusado");
  return data as { ok: boolean; id: string; nome: string };
}
export const apiCursoDocumentoApagar = (regime: Regime, cursoId: number, ficheiroId: string) =>
  api<{ ok: boolean }>(`/v1/cursos/${regime}/${cursoId}/documentos/${encodeURIComponent(ficheiroId)}`, { method: "DELETE" });

export type CursoFicha = { payload: Record<string, unknown>; criterios: { id: string; label: string }[] };
export const apiCursoFicha = (regime: Regime, cursoId: number) =>
  api<{ ficha: CursoFicha | null }>(`/v1/cursos/${regime}/${cursoId}/ficha`);
export const apiCursoFichas = (regime: Regime) =>
  api<{ fichas: { cursoId: number; payload: Record<string, unknown>; criterios: { id: string; label: string }[] }[] }>(`/v1/cursos/${regime}/fichas`);
export const apiSaveCursoFicha = (regime: Regime, cursoId: number, body: Partial<CursoFicha>) =>
  api<{ ok: boolean }>(`/v1/cursos/${regime}/${cursoId}/ficha`, { method: "PUT", body: JSON.stringify(body) });

export type FormandoDoc = { id: string; ok: boolean; fileName: string; data: string; driveFileId?: string; driveUrl?: string };
export type FormandoNota = { id: number; autor: string; texto: string; data: string };
export const apiFormandoDossier = (regime: Regime, id: number) =>
  api<{ docs: FormandoDoc[]; notas: FormandoNota[] }>(`/v1/formandos/${regime}/${id}/dossier`);
export const apiSaveFormandoDocs = (regime: Regime, id: number, docs: FormandoDoc[]) =>
  api<{ ok: boolean }>(`/v1/formandos/${regime}/${id}/docs`, { method: "PUT", body: JSON.stringify({ docs }) });
export const apiAddFormandoNota = (regime: Regime, id: number, texto: string) =>
  api<{ nota: FormandoNota }>(`/v1/formandos/${regime}/${id}/notas`, { method: "POST", body: JSON.stringify({ texto }) });

export type FormadorDoc = { id: string; uploaded: boolean; fileName: string; driveFileId?: string; driveUrl?: string };
export const apiFormadorDocs = (id: number) => api<{ docs: FormadorDoc[] }>(`/v1/formadores/${id}/docs`);
export const apiSaveFormadorDocs = (id: number, docs: FormadorDoc[]) =>
  api<{ ok: boolean }>(`/v1/formadores/${id}/docs`, { method: "PUT", body: JSON.stringify({ docs }) });

export type InqueritoResposta = { id: number; turma: string; formando: string; respostas: Record<string, unknown>; data: string };
export type InqueritoMetrica = {
  id: number; tipo: string; n: number;
  media?: number | null; pctSim?: number | null; contagens?: Record<string, number>;
};
export const apiInqueritoRespostas = (id: number) =>
  api<{ respostas: InqueritoResposta[]; metricas?: InqueritoMetrica[] }>(`/v1/inqueritos/${id}/respostas`);
export const apiAddInqueritoResposta = (id: number, body: { turma?: string; formando?: string; respostas: Record<string, unknown> }) =>
  api<{ ok: boolean }>(`/v1/inqueritos/${id}/respostas`, { method: "POST", body: JSON.stringify(body) });
export const apiInqueritoPublicoLink = (id: number) =>
  api<{ token: string; url: string }>(`/v1/inqueritos/${id}/publico`);
export type InqueritoPublico = {
  id: number;
  titulo: string;
  perguntas: { id: number; tipo: string; texto: string; opcoes: string[] }[];
};
export const apiPublicInquerito = (token: string) =>
  api<InqueritoPublico>(`/v1/public/inqueritos/${encodeURIComponent(token)}`);
export const apiPublicInqueritoResposta = (
  token: string,
  body: { turma?: string; formando?: string; respostas: Record<string, unknown> },
) => api<{ ok: boolean }>(`/v1/public/inqueritos/${encodeURIComponent(token)}/respostas`, {
  method: "POST",
  body: JSON.stringify(body),
});

export type Dashboard = {
  cards: {
    preinscritos: number; formandosAtivos: number; formandosGold: number; formandosFin: number;
    turmasAtivas: number; turmasTotal: number; cursosAtivos: number; cursosGold: number; cursosFin: number;
  };
  financeiro: {
    receitaTotal: number; receitaMes: number; receitaMesAnterior: number; variacaoMes: number | null;
    receitaMensal: { mes: string; v: number }[]; receita12m: number;
    pendentes: { valor: number; n: number }; pagos: number; ticketMedio: number;
    metodosPagamento: { metodo: string; valor: number; pct: number; color: string }[];
  };
  funil: { l: string; v: number }[];
  comercial?: {
    preInscritos: number;
    convertidos: number;
    conversaoPct: number | null;
    prePagos: number;
    formandosPre: number;
    formandosAuto: number;
    totalFormandos: number;
  } | null;
  conhecimento: { id: string; fonte: string; curto: string; detalhe: string; color: string; n: number; pct: number }[];
  topCursos: { nome: string; inscritos: number; receita: number; taxa: number | null }[];
  desagregar?: "curso" | "local" | "horario";
  desagregacao?: { chave: string; n: number; receita: number; pct: number }[];
  precos?: { curso: string; local: string; horario: string; inicio: string; preco: number }[];
  receitaMesCursos?: { nome: string; receita: number; pct: number; color: string }[];
  mesSeleccionado?: string;
  filtros?: { cursos: string[]; locais: string[]; horarios: string[] };
};
export type DashboardQuery = {
  regime?: "gold" | "fin";
  de?: string; ate?: string; curso?: string; local?: string; horario?: string;
  audiencia?: "todos" | "pre" | "formandos";
  desagregar?: "curso" | "local" | "horario";
  mes?: string;
};
export const apiDashboard = (q: DashboardQuery = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v) p.set(k, v);
  }
  const qs = p.toString();
  return api<Dashboard>(`/v1/dashboard${qs ? `?${qs}` : ""}`);
};

export type TurmaRegra = {
  id: number; regime: "gold" | "fin"; curso: string; local: string; horario: string;
  vagas: number; horas: number; horasSessao: number; formador: string;
  proximaData: string; nomePrefixo: string; activa: boolean;
};
export const apiTurmaRegras = (regime?: "gold" | "fin") =>
  api<{ regras: TurmaRegra[] }>(`/v1/turma-regras${regime ? `?regime=${regime}` : ""}`);
export const apiCreateTurmaRegra = (body: Record<string, unknown>) =>
  api<{ id: number }>("/v1/turma-regras", { method: "POST", body: JSON.stringify(body) });
export const apiPatchTurmaRegra = (id: number, body: Record<string, unknown>) =>
  api<{ ok: boolean }>(`/v1/turma-regras/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteTurmaRegra = (id: number) =>
  api<{ ok: boolean }>(`/v1/turma-regras/${id}`, { method: "DELETE" });
export const apiAplicarTurmaRegras = (regime?: "gold" | "fin") =>
  api<{ n: number; criadas: { id: number; nome: string; regime: string }[] }>("/v1/turmas/auto-regras", {
    method: "POST", body: JSON.stringify({ regime }),
  });

export type PercursoTurma = {
  id: number; nome: string; local: string; horario: string; dataInicio: string;
  cronograma: { data: string; horaInicio: string; horaFim: string; modulos: string[]; modalidade: string }[];
};
export type PercursoVista = {
  nome: string; curso: string; local?: string; horario?: string; preco?: number;
  tipos: { id: string; label: string; required?: boolean }[];
  ficheiros: { id: number; tipo: string; nome: string; created_at: string; estado?: string; observacao?: string }[];
  docsCompletos?: boolean;
  emFalta?: string[];
  precisaPagamento?: boolean;
  pagamento?: { entidade: string; referencia: string; valor: number; estado: string } | null;
  iban?: string;
  turmas?: PercursoTurma[];
  turmaEscolhida?: PercursoTurma | null;
  passo?: "documentos" | "turma" | "pagamento" | "concluido" | "correcao";
  encerrada?: boolean;
  correcao?: boolean;
};
export const apiPublicDocumentos = (token: string) =>
  api<PercursoVista>(`/v1/public/documentos/${encodeURIComponent(token)}`);
export const apiPublicEscolherTurma = (token: string, turmaId: number) =>
  api<PercursoVista>(`/v1/public/documentos/${encodeURIComponent(token)}/turma`, {
    method: "POST", body: JSON.stringify({ turmaId }),
  });
export async function apiPublicDocumentoUpload(token: string, file: File, tipo: string) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("tipo", tipo);
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("X-Gesforma-Client", "web");
  const res = await fetch(`${BASE}/v1/public/documentos/${encodeURIComponent(token)}`, {
    method: "POST", credentials: "include", headers, body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : "upload recusado");
  return data as { ok: boolean; nome: string };
}

export type Notificacao = {
  chave: string;
  tipo: "error" | "warn" | "info";
  titulo: string;
  texto: string;
  view: string;
  turmaId?: number;
  leadId?: number;
  tab?: string;
  lida: boolean;
};
export const apiNotificacoes = () => api<{ notificacoes: Notificacao[]; naoLidas: number }>("/v1/notificacoes");
export const apiMarcarLidas = (chaves: string[]) =>
  api<{ ok: boolean }>("/v1/notificacoes/lidas", { method: "POST", body: JSON.stringify({ chaves }) });
export const apiGoogleLoginStatus = () =>
  api<{ configured: boolean; redirectUri: string }>("/v1/auth/google");
export function googleLoginStartUrl() {
  return `${BASE}/v1/auth/google/start`;
}

export type MicrosoftStatus = {
  configured: boolean;
  redirectUri: string;
  tenantId?: string;
  clientId?: string;
  hasSecret?: boolean;
  fromEnv?: boolean;
  hint?: string;
};
export type SmtpStatus = {
  configured: boolean;
  fromEnv: boolean;
  hasPassword: boolean;
  host: string;
  port: number;
  login: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  hint: string;
};
export const apiSmtpStatus = () => api<SmtpStatus>("/v1/settings/smtp");
export const apiPutSmtpConfig = (body: {
  host?: string;
  port?: number;
  login: string;
  smtpKey?: string;
  fromName?: string;
  fromEmail: string;
  replyTo: string;
}) => api<SmtpStatus>("/v1/settings/smtp", { method: "PUT", body: JSON.stringify(body) });
export const apiSmtpDesligar = () =>
  api<SmtpStatus>("/v1/settings/smtp/desligar", { method: "POST", body: JSON.stringify({}) });
export const apiSmtpTeste = (to?: string) =>
  api<{ ok: boolean; id: string }>("/v1/settings/smtp/teste", { method: "POST", body: JSON.stringify({ to }) });

export const apiMicrosoftLoginStatus = () => api<MicrosoftStatus>("/v1/auth/microsoft");
export const apiPutMicrosoftConfig = (body: { clientId: string; clientSecret?: string; tenantId?: string }) =>
  api<MicrosoftStatus>("/v1/auth/microsoft/config", { method: "PUT", body: JSON.stringify(body) });
export const apiMicrosoftDisconnect = () =>
  api<MicrosoftStatus>("/v1/auth/microsoft/disconnect", { method: "POST" });
export function microsoftLoginStartUrl() {
  return `${BASE}/v1/auth/microsoft/start`;
}

export const apiEmailRules = () => api<{ rules: EmailRule[] }>("/v1/email/rules");
export const apiCreateRule = (body: Record<string, unknown>) =>
  api<{ id: number }>("/v1/email/rules", { method: "POST", body: JSON.stringify(body) });
export const apiPatchRule = (id: number, body: Record<string, unknown>) =>
  api<{ ok: boolean }>(`/v1/email/rules/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteRule = (id: number) =>
  api<{ ok: boolean }>(`/v1/email/rules/${id}`, { method: "DELETE" });
export const apiTestEmailRule = (id: number) =>
  api<{ ok: boolean; to: string; logged: boolean; id: string }>(`/v1/email/rules/${id}/teste`, { method: "POST", body: JSON.stringify({}) });

export const apiEmailTemplates = () => api<{ templates: EmailTemplate[] }>("/v1/email/templates");
export const apiPatchTemplate = (id: number, body: { nome?: string; assunto?: string; body_lines?: string[]; body_xml?: string; cta?: string; cta_href?: string; cta_ambito?: "preinscricao" | "contacto" | "documentos" | "pagamento" }) =>
  api<{ template: EmailTemplate }>(`/v1/email/templates/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const apiOps = () => api<OpsSnapshot>("/v1/ops");
export const apiPublicCursos = () => api<{ cursos: { nome: string; preco: number }[] }>("/v1/public/cursos");
export const apiPublicOferta = () =>
  api<{
    cursos: { nome: string; preco: number }[];
    turmas: import("./oferta").OfertaTurma[];
    edicoes?: { curso: string; local?: string; horario?: string; inicio?: string; preco: number; status?: string }[];
  }>("/v1/public/oferta");
export const apiPublicPreinscricao = (body: Record<string, unknown>) =>
  api<{ preinscricao: { id: number }; aviso: string }>("/v1/public/preinscricoes", { method: "POST", body: JSON.stringify(body) });
export const apiPublicOpcoes = (lista: string) =>
  api<{ lista: string; opcoes: string[] }>(`/v1/public/opcoes?lista=${encodeURIComponent(lista)}`);

export const apiCreatePreinscricao = (body: Record<string, unknown>) =>
  api<{ preinscricao: OpsSnapshot["preinscricoes"][number] }>("/v1/preinscricoes", { method: "POST", body: JSON.stringify(body) });
export const apiPatchPreinscricao = (id: number, body: Record<string, unknown>) =>
  api<{ preinscricao: OpsSnapshot["preinscricoes"][number] | null }>(`/v1/preinscricoes/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiContactarPreinscricao = (id: number, nota = "", meio = "") =>
  api<{ preinscricao: OpsSnapshot["preinscricoes"][number] | null }>(`/v1/preinscricoes/${id}/contactar`, { method: "POST", body: JSON.stringify({ nota, meio }) });
export const apiDeletePreinscricao = (id: number) => api<{ ok: boolean }>(`/v1/preinscricoes/${id}`, { method: "DELETE" });

export type CrmFila = "contactar" | "atrasados" | "hoje" | "agenda" | "converter" | "abertos" | "secretaria" | "preinscricao" | "minhas";
export type CrmSort = "inscrito" | "proximo" | "valor" | "nome" | "actividade";
export type CrmLead = OpsSnapshot["preinscricoes"][number] & { proximoContacto?: string };

export type CrmListQuery = {
  q?: string;
  estado?: string;
  curso?: string;
  local?: string;
  origem?: string;
  entrada?: "preinscricao" | "manual" | "";
  campanha?: string;
  comercialId?: string;
  fila?: CrmFila | "";
  page?: number;
  perPage?: number;
  sort?: CrmSort;
  kanban?: boolean;
  hoje?: string;
  regime?: "gold" | "fin";
};

export type CrmListResult = {
  items: CrmLead[];
  total: number;
  page: number;
  perPage: number;
  counts: {
    total: number; abertos: number; porContactar: number; conversa: number;
    pagos: number; formando: number; atrasados: number; hoje: number; converter: number; valorAberto: number;
    preinscricoes: number; manuais: number; filaPre?: number; filaSec?: number; desistiu?: number;
  };
  porEstado: Record<string, number>;
  facets: { cursos: string[]; locais: string[]; origens: string[]; campanhas: string[] };
  columns?: { estado: string; total: number; valor?: number; items: CrmLead[] }[];
};

function crmQs(q: CrmListQuery) {
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.estado && q.estado !== "Todos") p.set("estado", q.estado);
  if (q.curso) p.set("curso", q.curso);
  if (q.local) p.set("local", q.local);
  if (q.origem) p.set("origem", q.origem);
  if (q.entrada) p.set("entrada", q.entrada);
  if (q.campanha) p.set("campanha", q.campanha);
  if (q.comercialId) p.set("comercialId", q.comercialId);
  if (q.fila) p.set("fila", q.fila);
  if (q.page) p.set("page", String(q.page));
  if (q.perPage) p.set("perPage", String(q.perPage));
  if (q.sort) p.set("sort", q.sort);
  if (q.kanban) p.set("kanban", "1");
  if (q.hoje) p.set("hoje", q.hoje);
  if (q.regime) p.set("regime", q.regime);
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const apiCrmLeads = (q: CrmListQuery) => api<CrmListResult>(`/v1/crm/leads${crmQs(q)}`);
export const apiCrmSearch = (q: string) => api<{ leads: CrmLead[] }>(`/v1/crm/search?q=${encodeURIComponent(q)}`);

export type GlobalSearchKind = "email" | "telemovel" | "id" | "nome";
export type GlobalSearchGrupo = "formandos" | "formadores" | "formacoes" | "turmas" | "crm";
export type GlobalSearchHit = {
  grupo: GlobalSearchGrupo;
  tipo: string;
  nome: string;
  sub: string;
  view: string;
  formandoId?: number;
  formandoOrigem?: "gold-turma" | "gold-avulso" | "fin";
  formadorId?: number;
  leadId?: number;
  turmaId?: number;
  cursoId?: number;
  tab?: "overview" | "dtp";
};
export type GlobalSearchResult = {
  q: string;
  kind: GlobalSearchKind;
  kindLabel: string;
  groups: { grupo: GlobalSearchGrupo; label: string; items: GlobalSearchHit[] }[];
  total: number;
};
export const apiGlobalSearch = (q: string) =>
  api<GlobalSearchResult>(`/v1/search?q=${encodeURIComponent(q)}`);
export const apiCrmLote = (body: {
  ids: number[]; acao: "contactar" | "estado" | "seguimento" | "atribuir" | "etiqueta" | "adiar";
  estado?: string; proximoContacto?: string; nota?: string; comercialId?: string; etiquetaId?: number | null; dias?: number;
}) =>
  api<{ updated: number }>("/v1/crm/lote", { method: "POST", body: JSON.stringify(body) });

export type CrmCampoTipo = "texto" | "numero" | "data" | "lista";
export type CrmCampo = { id: number; label: string; chave: string; tipo: CrmCampoTipo; opcoes: string[]; valor?: string };
export type CrmLeadEvento = { id: number; tipo: string; titulo: string; detalhe: string; createdAt: string; actorName: string | null };
export type CrmLeadNota = { id: number; nota: string; meio?: string; resultado?: string; fixada?: boolean; createdAt: string; actorName: string | null };
export type CrmDossier = {
  lead: CrmLead;
  cliente: boolean;
  papel: "cliente" | "potencial";
  campos: CrmCampo[];
  notas: CrmLeadNota[];
  eventos: CrmLeadEvento[];
  outrosPedidos: CrmLead[];
  propostas: { id: number; curso: string; estado: string; valor: number; enviadaEm: string }[];
  docsUrl?: string;
  docsCompletos?: boolean;
  docsEmFalta?: string[];
  documentos?: { id: number; tipo: string; label: string; nome: string; url: string; createdAt: string; estado?: string; observacao?: string }[];
  docsFechado?: boolean;
  percursoConcluido?: boolean;
  pagamento?: { id: string; referencia: string; valor: number; estado: string; entidade: string } | null;
};
export const apiCrmDocValidar = (id: number, docId: number) =>
  api<CrmDossier>(`/v1/crm/leads/${id}/documentos/${docId}/validar`, { method: "POST", body: JSON.stringify({}) });
export const apiCrmDocRecusar = (id: number, docId: number, observacao: string) =>
  api<CrmDossier>(`/v1/crm/leads/${id}/documentos/${docId}/recusar`, { method: "POST", body: JSON.stringify({ observacao }) });
export const apiCrmDocAlertar = (id: number) =>
  api<{ ok: boolean }>(`/v1/crm/leads/${id}/documentos/alertar`, { method: "POST", body: JSON.stringify({}) });
export const apiDocAlertas = () =>
  api<{ alertas: { id: string; preinscricaoId: number; nome: string; apelido: string; curso: string; regime: "gold" | "fin"; createdAt: string }[] }>("/v1/alertas/documentos");
export const apiDocAlertaDispensar = (id: string) =>
  api<{ ok: boolean }>(`/v1/alertas/documentos/${encodeURIComponent(id)}/dispensar`, { method: "POST", body: JSON.stringify({}) });

export const apiCrmDossier = (id: number) => api<CrmDossier>(`/v1/crm/leads/${id}`);
export const apiCrmCampos = () => api<{ campos: CrmCampo[] }>("/v1/crm/campos");
export const apiCrmCampoCreate = (body: { label: string; tipo: CrmCampoTipo; opcoes?: string[] }) =>
  api<{ campo: CrmCampo }>("/v1/crm/campos", { method: "POST", body: JSON.stringify(body) });
export const apiCrmLeadCampos = (id: number, valores: { campoId: number; valor: string }[]) =>
  api<CrmDossier>(`/v1/crm/leads/${id}/campos`, { method: "POST", body: JSON.stringify({ valores }) });
export const apiCrmLeadNota = (id: number, nota: string, meio = "", resultado = "") =>
  api<CrmDossier>(`/v1/crm/leads/${id}/notas`, { method: "POST", body: JSON.stringify({ nota, meio, resultado }) });
export const apiCrmNotaFixar = (id: number, nid: number, fixada: boolean) =>
  api<CrmDossier>(`/v1/crm/leads/${id}/notas/${nid}/fixar`, { method: "POST", body: JSON.stringify({ fixada }) });
export const apiCrmCompletar = (id: number, body: Record<string, unknown>) =>
  api<CrmDossier>(`/v1/crm/leads/${id}/completar`, { method: "POST", body: JSON.stringify(body) });
export const apiCrmDuplicados = (email: string, telf: string, exceptId = 0) =>
  api<{ duplicados: { id: number; nome: string; apelido: string; email: string; telf: string; estado: string; curso: string }[] }>(
    `/v1/crm/duplicados?email=${encodeURIComponent(email)}&telf=${encodeURIComponent(telf)}&exceptId=${exceptId}`,
  );
export const apiCrmComerciais = (regime?: "gold" | "fin") =>
  api<{ comerciais: { id: string; name: string }[] }>(`/v1/crm/comerciais${regime ? `?regime=${regime}` : ""}`);

export type CrmEtiqueta = { id: number; nome: string; cor: string };
export const apiCrmEtiquetas = () => api<{ etiquetas: CrmEtiqueta[] }>("/v1/crm/etiquetas");
export const apiCrmEtiquetaCreate = (body: { nome: string; cor: string }) =>
  api<{ etiqueta: CrmEtiqueta }>("/v1/crm/etiquetas", { method: "POST", body: JSON.stringify(body) });
export const apiCrmEtiquetaDelete = (id: number) =>
  api<{ ok: boolean }>(`/v1/crm/etiquetas/${id}`, { method: "DELETE" });

export type WhatsappStatus = {
  ligado: boolean;
  hasToken: boolean;
  fromEnv: boolean;
  phoneId: string;
  displayPhone: string;
  verifyToken: string;
  sessoes: number;
  webhook: string;
  hint: string;
};
export const apiWhatsappStatus = () => api<WhatsappStatus>("/v1/crm/whatsapp");
export const apiPutWhatsappConfig = (body: { token?: string; phoneId?: string }) =>
  api<WhatsappStatus>("/v1/crm/whatsapp/config", { method: "PUT", body: JSON.stringify(body) });
export const apiWhatsappDesligar = () =>
  api<WhatsappStatus>("/v1/crm/whatsapp/desligar", { method: "POST" });
export const apiWhatsappConversa = (telefone: string) =>
  api<{ telefone: string; mensagens: { direccao: "in" | "out"; corpo: string; createdAt: string }[] }>(
    `/v1/crm/whatsapp/conversa?telefone=${encodeURIComponent(telefone)}`,
  );
export const apiWhatsappSimular = (telefone: string, texto: string) =>
  api<{ replies: string[]; telefone: string; passo?: string; leadId?: number | null }>(
    "/v1/crm/whatsapp/simular",
    { method: "POST", body: JSON.stringify({ telefone, texto }) },
  );

export async function apiCrmExport(q: CrmListQuery) {
  const headers = new Headers();
  headers.set("Accept", "text/csv");
  headers.set("X-Gesforma-Client", "web");
  const res = await fetch(`${BASE}/v1/crm/export${crmQs(q)}`, { credentials: "include", headers });
  if (!res.ok) throw new ApiError(res.status, "Não foi possível exportar.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "crm-leads.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const apiCreateFormandoGold = (body: Record<string, unknown>) =>
  api<{ formando: OpsSnapshot["formandosTurmas"][number] }>("/v1/formandos-gold", { method: "POST", body: JSON.stringify(body) });
export const apiPatchFormandoGold = (id: number, body: Record<string, unknown>) =>
  api<{ formando: OpsSnapshot["formandosTurmas"][number] | null }>(`/v1/formandos-gold/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteFormandoGold = (id: number) => api<{ ok: boolean }>(`/v1/formandos-gold/${id}`, { method: "DELETE" });

export const apiCreateFormandoFin = (body: Record<string, unknown>) =>
  api<{ formando: OpsSnapshot["formandosFin"][number] }>("/v1/formandos-fin", { method: "POST", body: JSON.stringify(body) });
export const apiPatchFormandoFin = (id: number, body: Record<string, unknown>) =>
  api<{ formando: OpsSnapshot["formandosFin"][number] | null }>(`/v1/formandos-fin/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteFormandoFin = (id: number) => api<{ ok: boolean }>(`/v1/formandos-fin/${id}`, { method: "DELETE" });

export const apiCreateCursoGold = (body: Record<string, unknown>) =>
  api<{ curso: OpsSnapshot["cursosGold"][number] }>("/v1/cursos-gold", { method: "POST", body: JSON.stringify(body) });
export const apiPatchCursoGold = (id: number, body: Record<string, unknown>) =>
  api<{ curso: OpsSnapshot["cursosGold"][number] | null }>(`/v1/cursos-gold/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteCursoGold = (id: number) => api<{ ok: boolean }>(`/v1/cursos-gold/${id}`, { method: "DELETE" });

export const apiCreateCursoFin = (body: Record<string, unknown>) =>
  api<{ curso: OpsSnapshot["cursosFin"][number] }>("/v1/cursos-fin", { method: "POST", body: JSON.stringify(body) });
export const apiPatchCursoFin = (id: number, body: Record<string, unknown>) =>
  api<{ curso: OpsSnapshot["cursosFin"][number] | null }>(`/v1/cursos-fin/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteCursoFin = (id: number) => api<{ ok: boolean }>(`/v1/cursos-fin/${id}`, { method: "DELETE" });

export const apiCreateTurmaGold = (body: Record<string, unknown>) =>
  api<{ turma: OpsSnapshot["turmasGold"][number] }>("/v1/turmas-gold", { method: "POST", body: JSON.stringify(body) });
export const apiPatchTurmaGold = (id: number, body: Record<string, unknown>) =>
  api<{ turma: OpsSnapshot["turmasGold"][number] | null }>(`/v1/turmas-gold/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteTurmaGold = (id: number) => api<{ ok: boolean }>(`/v1/turmas-gold/${id}`, { method: "DELETE" });

export const apiCreateTurmaFin = (body: Record<string, unknown>) =>
  api<{ turma: OpsSnapshot["turmasFin"][number] }>("/v1/turmas-fin", { method: "POST", body: JSON.stringify(body) });
export const apiPatchTurmaFin = (id: number, body: Record<string, unknown>) =>
  api<{ turma: OpsSnapshot["turmasFin"][number] | null }>(`/v1/turmas-fin/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteTurmaFin = (id: number) => api<{ ok: boolean }>(`/v1/turmas-fin/${id}`, { method: "DELETE" });

export const apiCreateFormador = (body: Record<string, unknown>) =>
  api<{ formador: OpsSnapshot["formadores"][number] }>("/v1/formadores", { method: "POST", body: JSON.stringify(body) });
export const apiPatchFormador = (id: number, body: Record<string, unknown>) =>
  api<{ formador: OpsSnapshot["formadores"][number] | null }>(`/v1/formadores/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteFormador = (id: number) => api<{ ok: boolean }>(`/v1/formadores/${id}`, { method: "DELETE" });

export const apiCreateCampanha = (body: Record<string, unknown>) =>
  api<{ campanha: OpsSnapshot["campanhas"][number] }>("/v1/campanhas", { method: "POST", body: JSON.stringify(body) });
export const apiPatchCampanha = (id: number, body: Record<string, unknown>) =>
  api<{ campanha: OpsSnapshot["campanhas"][number] | null }>(`/v1/campanhas/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteCampanha = (id: number) => api<{ ok: boolean }>(`/v1/campanhas/${id}`, { method: "DELETE" });

export const apiCreateBlog = (body: Record<string, unknown>) =>
  api<{ post: OpsSnapshot["blogPosts"][number] }>("/v1/blog", { method: "POST", body: JSON.stringify(body) });
export const apiPatchBlog = (id: number, body: Record<string, unknown>) =>
  api<{ post: OpsSnapshot["blogPosts"][number] | null }>(`/v1/blog/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteBlog = (id: number) => api<{ ok: boolean }>(`/v1/blog/${id}`, { method: "DELETE" });

export const apiCreatePagamento = (body: Record<string, unknown>) =>
  api<{ pagamento: OpsSnapshot["pagamentos"][number] }>("/v1/pagamentos", { method: "POST", body: JSON.stringify(body) });
export const apiPatchPagamento = (id: string, body: Record<string, unknown>) =>
  api<{ pagamento: OpsSnapshot["pagamentos"][number] | null }>(`/v1/pagamentos/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeletePagamento = (id: string) => api<{ ok: boolean }>(`/v1/pagamentos/${id}`, { method: "DELETE" });

export const apiCreateCatalog = (kind: string, regime: "gold" | "fin", payload: Record<string, unknown>) =>
  api<{ item: { id: number } & Record<string, unknown> }>(`/v1/catalog/${kind}`, { method: "POST", body: JSON.stringify({ regime, payload }) });
export const apiPatchCatalog = (kind: string, id: number, payload: Record<string, unknown>, regime?: "gold" | "fin") =>
  api<{ item: ({ id: number } & Record<string, unknown>) | null }>(`/v1/catalog/${kind}/${id}`, { method: "PATCH", body: JSON.stringify({ payload, regime }) });
export const apiDeleteCatalog = (kind: string, id: number) =>
  api<{ ok: boolean }>(`/v1/catalog/${kind}/${id}`, { method: "DELETE" });
export const apiPutSettings = (id: string, values: Record<string, string>) =>
  api<{ ok: boolean }>(`/v1/settings/${id}`, { method: "PUT", body: JSON.stringify({ values }) });

export const apiEmailJobs = () => api<{ stats: EmailJobStats; jobs: EmailJob[] }>("/v1/email/jobs");

export const apiDriveStatus = () => api<DriveStatus>("/v1/drive/status");
export const apiPutDriveConfig = (body: { clientId: string; clientSecret?: string; folderId?: string; folderName?: string }) =>
  api<DriveStatus>("/v1/drive/config", { method: "PUT", body: JSON.stringify(body) });
export const apiDriveDisconnect = () => api<{ ok: boolean }>("/v1/drive/disconnect", { method: "POST" });
export const apiDriveFiles = (q: DriveUploadContext = { kind: "" }) => {
  const p = new URLSearchParams();
  if (q.kind) p.set("kind", q.kind);
  if (q.regime) p.set("regime", q.regime);
  if (q.turma) p.set("turma", q.turma);
  if (q.formando) p.set("formando", q.formando);
  const qs = p.toString();
  return api<{ files: DriveFile[] }>(`/v1/drive/files${qs ? `?${qs}` : ""}`);
};
export const apiDeleteDriveFile = (id: string) =>
  api<{ ok: boolean }>(`/v1/drive/files/${id}`, { method: "DELETE" });

export async function apiUploadDrive(file: File, ctx: DriveUploadContext = { kind: "documento" }): Promise<DriveFile> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", ctx.kind);
  if (ctx.regime) fd.append("regime", ctx.regime);
  if (ctx.turma) fd.append("turma", ctx.turma);
  if (ctx.formando) fd.append("formando", ctx.formando);
  if (ctx.label) fd.append("label", ctx.label);
  if (ctx.fase) fd.append("fase", ctx.fase);
  if (ctx.itemId) fd.append("itemId", ctx.itemId);
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("X-Gesforma-Client", "web");
  beginViewLoad();
  try {
    const res = await fetch(`${BASE}/v1/drive/files`, { method: "POST", credentials: "include", headers, body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : "upload recusado");
    return (data as { file: DriveFile }).file;
  } finally {
    endViewLoad();
  }
}

export function driveOAuthStartUrl() {
  return `${BASE}/v1/drive/oauth/start`;
}

export async function apiDtpExport(regime: Regime, turmaId: number, filename?: string) {
  const headers = new Headers();
  headers.set("Accept", "application/zip");
  headers.set("X-Gesforma-Client", "web");
  beginViewLoad();
  try {
    const res = await fetch(`${BASE}/v1/dtp/${regime}/${turmaId}/export`, { credentials: "include", headers });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new ApiError(res.status, typeof data.error === "string" ? data.error : "exportação recusada");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cd = res.headers.get("content-disposition") ?? "";
    const named = cd.match(/filename="([^"]+)"/)?.[1];
    a.download = named || filename || `dtp-${turmaId}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } finally {
    endViewLoad();
  }
}

export function emitAutomation(
  type: "preinscricao.created" | "payment.confirmed" | "formando.completed" | "sessao.summary_signed",
  payload: { email: string; nome: string; curso?: string; turma?: string },
  key: string,
) {
  return api<{ queued: number; duplicate: boolean }>("/v1/events", {
    method: "POST",
    body: JSON.stringify({ type, payload, idempotencyKey: key }),
  }).catch(() => undefined);
}
