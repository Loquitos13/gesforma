const BASE = (import.meta.env.VITE_API_URL as string | undefined) || "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type SessionUser = { id: string; email: string; name: string; role: string };

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
  cta_ambito?: "preinscricao" | "plataforma";
  updated_at: string;
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
  const res = await fetch(`${BASE}${path}`, { ...init, credentials: "include", headers });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : "pedido recusado");
  return data as T;
}

// Health e Auth
export const apiHealth = () => api<{ ok: boolean; driver: string; mail: string }>("/health");
export const apiMe = () => api<{ user: SessionUser }>("/v1/me");
export const apiLogin = (email: string, password: string) =>
  api<{ user: SessionUser }>("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const apiLogout = () => api<{ ok: boolean }>("/v1/auth/logout", { method: "POST" });

// Emails
export const apiEmailRules = () => api<{ rules: EmailRule[] }>("/v1/email/rules");
export const apiCreateRule = (body: Record<string, unknown>) =>
  api<{ id: number }>("/v1/email/rules", { method: "POST", body: JSON.stringify(body) });
export const apiPatchRule = (id: number, body: Record<string, unknown>) =>
  api<{ ok: boolean }>(`/v1/email/rules/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteRule = (id: number) =>
  api<{ ok: boolean }>(`/v1/email/rules/${id}`, { method: "DELETE" });

export const apiEmailTemplates = () => api<{ templates: EmailTemplate[] }>("/v1/email/templates");
export const apiPatchTemplate = (id: number, body: { nome?: string; assunto?: string; body_lines?: string[]; body_xml?: string; cta?: string; cta_href?: string; cta_ambito?: "preinscricao" | "plataforma" }) =>
  api<{ template: EmailTemplate }>(`/v1/email/templates/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const apiEmailJobs = () => api<{ stats: EmailJobStats; jobs: EmailJob[] }>("/v1/email/jobs");

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

// Formadores
export const apiGetFormadores = () => api<{ formadores: any[] }>("/v1/formadores");
export const apiCreateFormador = (body: any) => api<{ formador: any }>("/v1/formadores", { method: "POST", body: JSON.stringify(body) });
export const apiPatchFormador = (id: number, body: any) => api<{ ok: boolean }>(`/v1/formadores/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteFormador = (id: number) => api<{ ok: boolean }>(`/v1/formadores/${id}`, { method: "DELETE" });

// Cursos
export const apiGetCursos = () => api<{ cursos: any[] }>("/v1/cursos");
export const apiCreateCurso = (body: any) => api<{ curso: any }>("/v1/cursos", { method: "POST", body: JSON.stringify(body) });
export const apiPatchCurso = (id: number, body: any) => api<{ ok: boolean }>(`/v1/cursos/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteCurso = (id: number) => api<{ ok: boolean }>(`/v1/cursos/${id}`, { method: "DELETE" });

// Turmas
export const apiGetTurmas = () => api<{ gold: any[]; fin: any[] }>("/v1/turmas");
export const apiCreateTurma = (body: any) => api<{ turma: any }>("/v1/turmas", { method: "POST", body: JSON.stringify(body) });
export const apiPatchTurma = (id: number, body: any) => api<{ ok: boolean }>(`/v1/turmas/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiSaveCronograma = (id: number, cronograma: any[]) => api<{ ok: boolean }>(`/v1/turmas/${id}/cronograma`, { method: "PUT", body: JSON.stringify({ cronograma }) });
export const apiToggleTurma = (id: number, activa: boolean) => api<{ ok: boolean }>(`/v1/turmas/${id}/toggle`, { method: "PATCH", body: JSON.stringify({ activa }) });
export const apiDeleteTurma = (id: number) => api<{ ok: boolean }>(`/v1/turmas/${id}`, { method: "DELETE" });

// Pre-inscrições
export const apiGetPreinscricoes = () => api<{ preinscricoes: any[] }>("/v1/preinscricoes");
export const apiCreatePreinscricao = (body: any) => api<{ id: number }>("/v1/preinscricoes", { method: "POST", body: JSON.stringify(body) });
export const apiPatchPreinscricao = (id: number, body: any) => api<{ ok: boolean }>(`/v1/preinscricoes/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeletePreinscricao = (id: number) => api<{ ok: boolean }>(`/v1/preinscricoes/${id}`, { method: "DELETE" });

// Formandos Turmas
export const apiGetFormandosTurmas = () => api<{ formandosTurmas: any[] }>("/v1/formandos-turmas");
export const apiCreateFormandoTurma = (body: any) => api<{ id: number }>("/v1/formandos-turmas", { method: "POST", body: JSON.stringify(body) });
export const apiPatchFormandoTurma = (id: number, body: any) => api<{ ok: boolean }>(`/v1/formandos-turmas/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteFormandoTurma = (id: number) => api<{ ok: boolean }>(`/v1/formandos-turmas/${id}`, { method: "DELETE" });

// Formandos Fin
export const apiGetFormandosFin = () => api<{ formandosFin: any[] }>("/v1/formandos-fin");
export const apiCreateFormandoFin = (body: any) => api<{ id: number }>("/v1/formandos-fin", { method: "POST", body: JSON.stringify(body) });
export const apiPatchFormandoFin = (id: number, body: any) => api<{ ok: boolean }>(`/v1/formandos-fin/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteFormandoFin = (id: number) => api<{ ok: boolean }>(`/v1/formandos-fin/${id}`, { method: "DELETE" });

// Transações e Pagamentos
export const apiGetTransacoes = () => api<{ transacoes: any[] }>("/v1/transacoes");
export const apiCreateTransacao = (body: any) => api<{ id: string; ok: boolean }>("/v1/transacoes", { method: "POST", body: JSON.stringify(body) });
export const apiPatchTransacao = (id: string, body: any) => api<{ ok: boolean }>(`/v1/transacoes/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiWebhookPagamento = (body: any) => api<{ ok: boolean; processado: boolean }>("/v1/pagamentos/webhook", { method: "POST", body: JSON.stringify(body) });

// DTP
export const apiGetDtp = (turmaId: number) => api<{ dtp: any }>(`/v1/dtp/${turmaId}`);
export const apiSaveDtp = (turmaId: number, body: any) => api<{ ok: boolean }>(`/v1/dtp/${turmaId}`, { method: "PUT", body: JSON.stringify(body) });

// Catálogo
export const apiGetCatalogo = (tipo: string) => api<{ items: any[] }>(`/v1/catalogo/${tipo}`);
export const apiCreateCatalogo = (tipo: string, data: any) => api<any>(`/v1/catalogo/${tipo}`, { method: "POST", body: JSON.stringify(data) });
export const apiDeleteCatalogo = (tipo: string, id: number) => api<{ ok: boolean }>(`/v1/catalogo/${tipo}/${id}`, { method: "DELETE" });

// Notificações
export const apiGetNotificacoes = () => api<{ notificacoes: any[] }>("/v1/notificacoes");
export const apiMarcarNotificacaoLida = (id: number) => api<{ ok: boolean }>(`/v1/notificacoes/${id}/lida`, { method: "PATCH" });
export const apiMarcarTodasNotificacoesLidas = () => api<{ ok: boolean }>("/v1/notificacoes/marcar-todas-lidas", { method: "POST" });

// Configurações
export const apiGetConfiguracoes = () => api<{ configuracoes: Record<string, any> }>("/v1/configuracoes");
export const apiSaveConfiguracao = (id: string, dados: any) => api<{ ok: boolean }>("/v1/configuracoes", { method: "PUT", body: JSON.stringify({ id, dados }) });

// Inquéritos
export const apiGetInqueritos = () => api<{ inqueritos: any[] }>("/v1/inqueritos");
export const apiCreateInquerito = (body: any) => api<{ inquerito: any }>("/v1/inqueritos", { method: "POST", body: JSON.stringify(body) });
export const apiResponderInquerito = (id: number, respostas: any[]) => api<{ ok: boolean }>(`/v1/inqueritos/${id}/responder`, { method: "POST", body: JSON.stringify({ respostas }) });

// Ficheiros (Upload & Download Seguro)
export const apiUploadFicheiro = (body: { nome: string; mimeType?: string; base64: string; contexto?: string; referenciaId?: string }) =>
  api<{ id: string; nome: string; tamanho: number; url: string }>("/v1/ficheiros/upload", { method: "POST", body: JSON.stringify(body) });

export const apiDownloadFicheiroUrl = (id: string) => `${BASE}/v1/ficheiros/${id}`;

// Exportação de Turma
export const apiExportTurmaUrl = (turmaId: number, pack: string) => `${BASE}/v1/turmas/${turmaId}/export/${pack}`;
