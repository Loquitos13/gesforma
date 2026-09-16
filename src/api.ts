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
  cta_ambito?: "preinscricao" | "contacto";
  updated_at: string;
};

export type OpsSnapshot = {
  preinscricoes: Array<{
    id: number; inscrito: string; nome: string; apelido: string; email: string; telf: string;
    inicioCurso: string; concelho: string; local: string; curso: string; preco: number;
    estado: string; campanha: string; origem: string; contactadoEm: string | null; notas: string;
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
  cursosGold: Array<{ id: number; nome: string; categoria: string; tipo: string; preco: number; regime: string; horas: number; estado: string }>;
  cursosFin: Array<{ id: number; ufcdCod: string; ufcd: string; nomeComercial: string; regime: string; horas: number; estado: string }>;
  turmasGold: Array<{
    id: number; dataInicio: string; nome: string; curso: string; local: string; horario: string;
    totalAlunos: number; vagas: number; estado: string; formador: string; horas: number; cronograma: unknown[];
  }>;
  turmasFin: Array<{
    id: number; dataInicio: string; nome: string; curso: string; ufcdCod: string; local: string; horario: string;
    alunos: number; alunosTotal: number; estado: string; horas: number; formador: string; activa: boolean; cronograma: unknown[];
  }>;
  formadores: Array<{
    id: number; nome: string; telf: string; email: string; especialidade: string; ccp: string; nif: string;
    regimes: string[]; estado: string;
  }>;
  campanhas: Array<{ id: number; nome: string; data: string; encarregado: string; preinscricoes: number; pagos: number; receita: number; custo: number }>;
  blogPosts: Array<{ id: number; titulo: string; slug: string; data: string; status: string }>;
  pagamentos: Array<{ id: string; nome: string; valor: number; metodo: string; curso: string; data: string; estado: string }>;
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
  const res = await fetch(`${BASE}${path}`, { ...init, credentials: "include", headers });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : "pedido recusado");
  return data as T;
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
};

export const apiHealth = () => api<{ ok: boolean; driver: string; mail: string; drive?: boolean }>("/health");
export const apiMe = () => api<{ user: SessionUser }>("/v1/me");
export const apiLogin = (email: string, password: string) =>
  api<{ user: SessionUser }>("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const apiLogout = () => api<{ ok: boolean }>("/v1/auth/logout", { method: "POST" });

export const apiEmailRules = () => api<{ rules: EmailRule[] }>("/v1/email/rules");
export const apiCreateRule = (body: Record<string, unknown>) =>
  api<{ id: number }>("/v1/email/rules", { method: "POST", body: JSON.stringify(body) });
export const apiPatchRule = (id: number, body: Record<string, unknown>) =>
  api<{ ok: boolean }>(`/v1/email/rules/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiDeleteRule = (id: number) =>
  api<{ ok: boolean }>(`/v1/email/rules/${id}`, { method: "DELETE" });

export const apiEmailTemplates = () => api<{ templates: EmailTemplate[] }>("/v1/email/templates");
export const apiPatchTemplate = (id: number, body: { nome?: string; assunto?: string; body_lines?: string[]; body_xml?: string; cta?: string; cta_href?: string; cta_ambito?: "preinscricao" | "contacto" }) =>
  api<{ template: EmailTemplate }>(`/v1/email/templates/${id}`, { method: "PATCH", body: JSON.stringify(body) });

export const apiOps = () => api<OpsSnapshot>("/v1/ops");
export const apiPublicCursos = () => api<{ cursos: { nome: string; preco: number }[] }>("/v1/public/cursos");
export const apiPublicPreinscricao = (body: Record<string, unknown>) =>
  api<{ preinscricao: { id: number }; aviso: string }>("/v1/public/preinscricoes", { method: "POST", body: JSON.stringify(body) });

export const apiCreatePreinscricao = (body: Record<string, unknown>) =>
  api<{ preinscricao: OpsSnapshot["preinscricoes"][number] }>("/v1/preinscricoes", { method: "POST", body: JSON.stringify(body) });
export const apiPatchPreinscricao = (id: number, body: Record<string, unknown>) =>
  api<{ preinscricao: OpsSnapshot["preinscricoes"][number] | null }>(`/v1/preinscricoes/${id}`, { method: "PATCH", body: JSON.stringify(body) });
export const apiContactarPreinscricao = (id: number, nota = "") =>
  api<{ preinscricao: OpsSnapshot["preinscricoes"][number] | null }>(`/v1/preinscricoes/${id}/contactar`, { method: "POST", body: JSON.stringify({ nota }) });
export const apiDeletePreinscricao = (id: number) => api<{ ok: boolean }>(`/v1/preinscricoes/${id}`, { method: "DELETE" });

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
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("X-Gesforma-Client", "web");
  const res = await fetch(`${BASE}/v1/drive/files`, { method: "POST", credentials: "include", headers, body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : "upload recusado");
  return (data as { file: DriveFile }).file;
}

export function driveOAuthStartUrl() {
  return `${BASE}/v1/drive/oauth/start`;
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
