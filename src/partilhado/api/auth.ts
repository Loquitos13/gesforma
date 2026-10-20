// API do domínio "auth": sessão, palavra-passe e entrada com Google/Microsoft.
import { BASE, api, enviar } from "./cliente";

export type UtilizadorSessao = { id: string; email: string; name: string; role: string; mustChangePassword?: boolean };

export const apiSessao = (signal?: AbortSignal) => api<{ user: UtilizadorSessao; pode: string[] }>("/v1/me", { signal, silencioso: true });
export const apiSair = () => enviar.post<{ ok: true }>("/v1/auth/logout");
export const apiMudarPalavraPasse = (password: string) => enviar.post<{ ok: true; user: UtilizadorSessao }>("/v1/auth/password", { password });
export const apiGoogleDisponivel = (signal?: AbortSignal) => api<{ configured: boolean; redirectUri: string }>("/v1/auth/google", { signal, silencioso: true });
export const urlEntrarGoogle = () => `${BASE}/v1/auth/google/start`;
export const urlEntrarMicrosoft = () => `${BASE}/v1/auth/microsoft/start`;
