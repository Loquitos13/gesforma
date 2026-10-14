// API do domínio "listas": listas de opções (origens, métodos, concelhos, …) com o uso de cada opção.
import { api, enviar } from "./cliente";

export type ResumoLista = { id: string; titulo: string; descricao: string; opcoes: number };
export type OpcaoLista = { id: number; nome: string; uso: number; usoPor: Record<string, number> };

export const apiListas = (signal?: AbortSignal) => api<{ listas: ResumoLista[] }>("/v1/listas", { signal, silencioso: true });

export const apiLista = (lista: string, signal?: AbortSignal) =>
  api<{ lista: string; titulo: string; descricao: string; opcoes: OpcaoLista[] }>(`/v1/listas/${encodeURIComponent(lista)}`, { signal, silencioso: true });

export const apiCriarOpcao = (lista: string, nome: string) =>
  enviar.post<{ opcao: OpcaoLista }>(`/v1/listas/${encodeURIComponent(lista)}`, { nome });

export const apiRenomearOpcao = (lista: string, id: number, nome: string) =>
  enviar.post<{ ok: boolean; registos: number }>(`/v1/listas/${encodeURIComponent(lista)}/${id}/renomear`, { nome });

export const apiApagarOpcao = (lista: string, id: number) => enviar.delete<{ ok: boolean }>(`/v1/listas/${encodeURIComponent(lista)}/${id}`);
