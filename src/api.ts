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

export const apiHealth = () => api<{ ok: boolean; driver: string; mail: string }>("/health");
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
export const apiPatchTemplate = (id: number, body: { nome?: string; assunto?: string; body_lines?: string[]; body_xml?: string; cta?: string }) =>
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
