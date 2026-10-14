// API do domínio "site": definições (`app_settings`), conteúdo do site e imagens do topo.
import { api, enviar, enviarFicheiro } from "./cliente";

export type Definicoes = Record<string, Record<string, string>>;

export const apiDefinicoes = (signal?: AbortSignal) => api<{ settings: Definicoes }>("/v1/settings", { signal, silencioso: true });

export const apiGravarDefinicao = (id: string, values: Record<string, string>) =>
  enviar.put<{ ok: boolean; id: string; values: Record<string, string> }>(`/v1/settings/${encodeURIComponent(id)}`, { values });

export const apiImagemHero = (slot: "1" | "2" | "fundo" | "apresentacao", ficheiro: File) =>
  enviarFicheiro<{ nome: string; url: string }>(`/v1/site/hero/${slot}/imagem`, ficheiro);
