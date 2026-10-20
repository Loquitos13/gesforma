// API do domínio "configuracoes": estado das secções, definições, SMTP, Drive, Microsoft e WhatsApp.
import { BASE, api, enviar, enviarFicheiro } from "./cliente";

export type EstadoConfiguracoes = {
  entidade: { completa: boolean; emFalta: string[]; iban: boolean };
  regras: Record<string, number | boolean>;
  lembrete: { activo: boolean; quantidade: number; unidade: string; maximo: number };
  smtp: { ligado: boolean; fromEnv: boolean; remetente: string | null };
  drive: { configurado: boolean; ligado: boolean; email: string | null; modo: string };
  microsoft: { ligado: boolean };
  whatsapp: { ligado: boolean };
  googleAvaliacoes: { ligado: boolean; erro: boolean };
  pagamentos: { gateway: string; metodos: string[] };
  moodle: { estado: string };
  avisos: number;
  remetentePadrao: string;
};

export const apiEstadoConfiguracoes = (signal?: AbortSignal) =>
  api<EstadoConfiguracoes>("/v1/configuracoes/estado", { signal });

export const apiDefinicoes = (signal?: AbortSignal) =>
  api<{ settings: Record<string, Record<string, string>> }>("/v1/settings", { signal });

export const apiGravarDefinicao = (id: string, values: Record<string, string>) =>
  enviar.put<{ ok: true; id: string; values: Record<string, string> }>(`/v1/settings/${id}`, { values });

// ─── SMTP ────────────────────────────────────────────────────────────────────

export type EstadoSmtp = {
  configured: boolean; fromEnv: boolean; hasPassword: boolean; host: string; port: number; login: string;
  fromName: string; fromEmail: string; replyTo: string; hint: string;
};
export type CorpoSmtp = { host?: string; port?: number; login: string; smtpKey?: string; fromName?: string; fromEmail: string; replyTo: string };

export const apiSmtp = (signal?: AbortSignal) => api<EstadoSmtp>("/v1/settings/smtp", { signal });
export const apiGravarSmtp = (corpo: CorpoSmtp) => enviar.put<EstadoSmtp>("/v1/settings/smtp", corpo);
export const apiDesligarSmtp = () => enviar.post<EstadoSmtp>("/v1/settings/smtp/desligar", {});

/** Avaliações Google: a chave nunca volta do servidor. */
export type EstadoAvaliacoesGoogle = {
  configurado: boolean; placeId: string; temChave: boolean; atualizadoEm: string | null;
  rating: number | null; total: number; quantas: number; erro: string | null;
};
export const apiAvaliacoesGoogle = (signal?: AbortSignal) => api<EstadoAvaliacoesGoogle>("/v1/settings/google-avaliacoes", { signal });
export const apiGravarAvaliacoesGoogle = (corpo: { placeId: string; chave?: string }) => enviar.put<EstadoAvaliacoesGoogle>("/v1/settings/google-avaliacoes", corpo);
export const apiAtualizarAvaliacoesGoogle = () => enviar.post<EstadoAvaliacoesGoogle>("/v1/settings/google-avaliacoes/atualizar", {});
export const apiDesligarAvaliacoesGoogle = () => enviar.post<EstadoAvaliacoesGoogle>("/v1/settings/google-avaliacoes/desligar", {});
export const apiTestarSmtp = (to?: string) => enviar.post<{ ok: true; id: string }>("/v1/settings/smtp/teste", { to });

// ─── Google Drive ────────────────────────────────────────────────────────────

export type EstadoDrive = {
  configured: boolean; connected: boolean; email: string | null; folderName: string; folderId: string | null;
  mode: "google" | "local"; hint: string; redirectUri?: string; loginRedirectUri?: string; clientId?: string;
  hasSecret?: boolean; fromEnv?: boolean;
};

export const apiDrive = (signal?: AbortSignal) => api<EstadoDrive>("/v1/drive/status", { signal });
export const apiGravarDrive = (corpo: { clientId: string; clientSecret?: string; folderId?: string; folderName?: string }) =>
  enviar.put<EstadoDrive>("/v1/drive/config", corpo);
export const apiDesligarDrive = () => enviar.post<{ ok: true }>("/v1/drive/disconnect");
export const urlLigarDrive = () => `${BASE}/v1/drive/oauth/start`;

// ─── Microsoft ───────────────────────────────────────────────────────────────

export type EstadoMicrosoft = {
  configured: boolean; redirectUri: string; tenantId?: string; clientId?: string; hasSecret?: boolean; fromEnv?: boolean; hint?: string;
};

export const apiMicrosoft = (signal?: AbortSignal) => api<EstadoMicrosoft>("/v1/auth/microsoft", { signal });
export const apiGravarMicrosoft = (corpo: { clientId: string; clientSecret?: string; tenantId?: string }) =>
  enviar.put<EstadoMicrosoft>("/v1/auth/microsoft/config", corpo);
export const apiDesligarMicrosoft = () => enviar.post<EstadoMicrosoft>("/v1/auth/microsoft/disconnect");

// ─── WhatsApp ────────────────────────────────────────────────────────────────

export type EstadoWhatsapp = {
  ligado: boolean; hasToken: boolean; fromEnv: boolean; phoneId: string; displayPhone: string;
  verifyToken: string; sessoes: number; webhook: string; hint: string;
};

export const apiWhatsapp = (signal?: AbortSignal) => api<EstadoWhatsapp>("/v1/crm/whatsapp", { signal });
export const apiGravarWhatsapp = (corpo: { token?: string; phoneId?: string }) => enviar.put<EstadoWhatsapp>("/v1/crm/whatsapp/config", corpo);
export const apiDesligarWhatsapp = () => enviar.post<EstadoWhatsapp>("/v1/crm/whatsapp/desligar");

export const apiWhatsappConversa = (telefone: string) =>
  api<{ telefone: string; mensagens: { direccao: "in" | "out"; corpo: string; createdAt: string }[] }>(
    `/v1/crm/whatsapp/conversa?telefone=${encodeURIComponent(telefone)}`,
  );
export const apiWhatsappSimular = (telefone: string, texto: string) =>
  enviar.post<{ replies: string[]; telefone: string; passo?: string; leadId?: number | null; ligado: boolean }>(
    "/v1/crm/whatsapp/simular", { telefone, texto },
  );

// ─── Logótipo da entidade ────────────────────────────────────────────────────

export type LogoEntidade = { nome: string; mime: string; versao: string; actualizado: string; tamanho: number };

export const apiLogo = (signal?: AbortSignal) => api<{ logo: LogoEntidade | null }>("/v1/configuracoes/logo", { signal });
export const apiCarregarLogo = (ficheiro: File) => enviarFicheiro<{ logo: LogoEntidade }>("/v1/configuracoes/logo", ficheiro);
export const apiApagarLogo = () => enviar.delete<{ ok: true }>("/v1/configuracoes/logo");
