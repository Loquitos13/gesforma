import { ApiError, BASE, api } from "./api/cliente";
import type { Regime } from "./api/pedagogia";

export { ApiError };
export * from "./api/pedagogia";
export * from "./api/publico";

export type StaffRole = "admin" | "secretaria" | "comercial" | "financiada" | "formador" | "formando";
export type SessionUser = { id: string; email: string; name: string; role: StaffRole | string; mustChangePassword?: boolean };

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
export const apiMe = () => api<{ user: SessionUser; pode?: string[] }>("/v1/me");
export const apiRecuperarAcesso = (email: string) =>
  api<{ ok: boolean }>("/v1/auth/recuperar", { method: "POST", body: JSON.stringify({ email }) });
export const apiReporPalavraPasse = (token: string, password: string) =>
  api<{ ok: boolean }>("/v1/auth/repor", { method: "POST", body: JSON.stringify({ token, password }) });
/** Gera (ou liga) o acesso à área do formando; com `enviarEmail` o utilizador e a palavra-passe seguem por email. */
export const apiGerarAcessoFormando = (regime: "gold" | "fin", id: number, repor = false, enviarEmail = false) =>
  api<{ acesso: { email: string; password?: string; criado: boolean; reposto: boolean; emailEnviado?: boolean } }>(`/v1/formandos/${regime}/${id}/acesso`, { method: "POST", body: JSON.stringify({ repor, enviarEmail }) });
export const apiLogin = (email: string, password: string) =>
  api<{ user: SessionUser }>("/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
export const apiChangeOwnPassword = (password: string) =>
  api<{ ok: boolean; user: SessionUser }>("/v1/auth/password", { method: "POST", body: JSON.stringify({ password }) });
/** Mudar a própria palavra-passe, por vontade (com a actual). */
export const apiAlterarMinhaPalavraPasse = (atual: string, password: string) =>
  api<{ ok: boolean; user: SessionUser }>("/v1/auth/password", { method: "POST", body: JSON.stringify({ atual, password }) });
export const apiLogout = () => api<{ ok: boolean }>("/v1/auth/logout", { method: "POST" });

export type DocPreinscricaoCurso = {
  id: string;
  label: string;
  required: boolean;
  pedido: boolean;
  origem: "base" | "extra" | "dossie";
  modelo?: string;
};
export const apiDocsPreinscricao = (regime: Regime, cursoId: number) =>
  api<{ aplica: boolean; tipo: string; docs: DocPreinscricaoCurso[] }>(`/v1/cursos/${regime}/${cursoId}/docs-preinscricao`);
export const apiSaveDocsPreinscricao = (
  regime: Regime,
  cursoId: number,
  body: { ocultos: string[]; extra: { id?: string; label: string; required: boolean }[] },
) => api<{ ok: boolean }>(`/v1/cursos/${regime}/${cursoId}/docs-preinscricao`, { method: "PUT", body: JSON.stringify(body) });
export async function apiDocsPreinscricaoUpload(regime: Regime, cursoId: number, docId: string, file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("X-Gesforma-Client", "web");
  const res = await fetch(`${BASE}/v1/cursos/${regime}/${cursoId}/docs-preinscricao/${encodeURIComponent(docId)}/modelo`, {
    method: "POST", credentials: "include", headers, body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : "upload recusado");
  return data as { ok: boolean; nome: string };
}
export const apiDocsPreinscricaoApagarModelo = (regime: Regime, cursoId: number, docId: string) =>
  api<{ ok: boolean }>(`/v1/cursos/${regime}/${cursoId}/docs-preinscricao/${encodeURIComponent(docId)}/modelo`, { method: "DELETE" });

export type CursoFicha = { payload: Record<string, unknown>; criterios: { id: string; label: string }[] };
export const apiCursoFicha = (regime: Regime, cursoId: number) =>
  api<{ ficha: CursoFicha | null }>(`/v1/cursos/${regime}/${cursoId}/ficha`);
export const apiCursoFichas = (regime: Regime) =>
  api<{ fichas: { cursoId: number; payload: Record<string, unknown>; criterios: { id: string; label: string }[] }[] }>(`/v1/cursos/${regime}/fichas`);
export async function apiBlogImagem(file: File) {
  const fd = new FormData();
  fd.append("file", file);
  const headers = new Headers();
  headers.set("Accept", "application/json");
  headers.set("X-Gesforma-Client", "web");
  const res = await fetch(`${BASE}/v1/blog/imagem`, {
    method: "POST", credentials: "include", headers, body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : "upload recusado");
  return data as { nome: string; url: string };
}

export type FormadorDoc = { id: string; uploaded: boolean; fileName: string; driveFileId?: string; driveUrl?: string };
export const apiFormadorDocs = (id: number) => api<{ docs: FormadorDoc[] }>(`/v1/formadores/${id}/docs`);
export const apiSaveFormadorDocs = (id: number, docs: FormadorDoc[]) =>
  api<{ ok: boolean }>(`/v1/formadores/${id}/docs`, { method: "PUT", body: JSON.stringify({ docs }) });
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

export const apiMicrosoftLoginStatus = () => api<MicrosoftStatus>("/v1/auth/microsoft");
export function microsoftLoginStartUrl() {
  return `${BASE}/v1/auth/microsoft/start`;
}

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
export const apiDocAlertas = () =>
  api<{ alertas: { id: string; preinscricaoId: number; nome: string; apelido: string; curso: string; regime: "gold" | "fin"; createdAt: string }[] }>("/v1/alertas/documentos");
export const apiDocAlertaDispensar = (id: string) =>
  api<{ ok: boolean }>(`/v1/alertas/documentos/${encodeURIComponent(id)}/dispensar`, { method: "POST", body: JSON.stringify({}) });

export const apiDriveStatus = () => api<DriveStatus>("/v1/drive/status");
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
  const res = await fetch(`${BASE}/v1/drive/files`, { method: "POST", credentials: "include", headers, body: fd });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, typeof data.error === "string" ? data.error : "upload recusado");
  return (data as { file: DriveFile }).file;
}

export const apiEnviarInqueritosTurma = (regime: "gold" | "fin", turmaId: number) =>
  api<{ ok: boolean; enviados: number; semEmail: number; inqueritos: number }>(`/v1/turmas/${regime}/${turmaId}/inqueritos/enviar`, { method: "POST", body: "{}" });

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
