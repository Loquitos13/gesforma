// API do domínio "utilizadores": contas, perfis, palavras-passe e sessões (só administração).
import { api, enviar, qs } from "./cliente";

export type PerfilUtilizador = "admin" | "secretaria" | "comercial" | "financiada" | "formador" | "formando";

export type Utilizador = {
  id: string;
  name: string;
  email: string;
  role: PerfilUtilizador;
  active: boolean;
  mustChangePassword: boolean;
  created_at: string;
  last_login_at: string | null;
  sessions_open: number;
};

export type SessaoUtilizador = { id: string; criada: string; expira: string; ip: string | null; navegador: string | null };

export type FiltrosUtilizadores = { perfil?: string; estado?: string; q?: string };

export function apiUtilizadores(f: FiltrosUtilizadores, signal?: AbortSignal) {
  return api<{ users: Utilizador[]; contagens: { role: PerfilUtilizador; total: number; ativos: number }[] }>(
    `/v1/utilizadores${qs(f)}`, { signal, silencioso: true },
  );
}

export function apiUtilizador(id: string, signal?: AbortSignal) {
  return api<{ user: Utilizador; sessoes: SessaoUtilizador[] }>(`/v1/utilizadores/${id}`, { signal, silencioso: true });
}

export function apiCriarUtilizador(corpo: { name: string; email: string; password: string; role: PerfilUtilizador; mustChangePassword: boolean }) {
  return enviar.post<{ user: Utilizador }>("/v1/utilizadores", corpo);
}

export function apiAlterarUtilizador(id: string, corpo: { name?: string; email?: string; role?: PerfilUtilizador; active?: boolean }) {
  return enviar.patch<{ user: Utilizador }>(`/v1/utilizadores/${id}`, corpo);
}

export function apiNovaPalavraPasse(id: string, password: string, opts: { revokeSessions: boolean; mustChangePassword: boolean }) {
  return enviar.post<{ ok: true }>(`/v1/utilizadores/${id}/password`, { password, ...opts });
}

export function apiTerminarSessoes(id: string) {
  return enviar.post<{ ok: true; terminadas: number; propria: boolean }>(`/v1/utilizadores/${id}/terminar-sessoes`);
}

export function apiApagarUtilizador(id: string) {
  return enviar.delete<{ ok: true }>(`/v1/utilizadores/${id}`);
}
