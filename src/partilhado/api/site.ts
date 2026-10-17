// API do domínio "site": definições (`app_settings`), conteúdo do site e imagens do topo.
import { api, enviar, enviarFicheiro } from "./cliente";

/** Avaliações da ENA no Google (cópia guardada no servidor; lista vazia se não estiver configurado). */
export type AvaliacoesGooglePublicas = {
  rating: number | null; total: number; url: string;
  avaliacoes: { autor: string; autorUrl: string; foto: string; estrelas: number; texto: string; quando: string; data: string }[];
};
export const apiAvaliacoesGooglePublicas = () => api<AvaliacoesGooglePublicas>("/v1/public/avaliacoes-google", { silencioso: true });

export type Definicoes = Record<string, Record<string, string>>;

export const apiDefinicoes = (signal?: AbortSignal) => api<{ settings: Definicoes }>("/v1/settings", { signal, silencioso: true });

export const apiGravarDefinicao = (id: string, values: Record<string, string>) =>
  enviar.put<{ ok: boolean; id: string; values: Record<string, string> }>(`/v1/settings/${encodeURIComponent(id)}`, { values });

export const apiImagemHero = (slot: "1" | "2" | "fundo" | "apresentacao", ficheiro: File) =>
  enviarFicheiro<{ nome: string; url: string }>(`/v1/site/hero/${slot}/imagem`, ficheiro);

/** Páginas do editor visual (JSON dos blocos do Puck). */
export type PaginaEditor = { rascunho: unknown; publicado: unknown; publicadoEm: string | null; atualizadoEm: string | null };
export const apiPaginaSite = (pagina: string, signal?: AbortSignal) =>
  api<PaginaEditor>(`/v1/site/paginas/${encodeURIComponent(pagina)}`, { signal });
export const apiRascunhoPagina = (pagina: string, dados: unknown) =>
  enviar.put<{ ok: boolean }>(`/v1/site/paginas/${encodeURIComponent(pagina)}/rascunho`, { dados });
export const apiPublicarPagina = (pagina: string, dados: unknown) =>
  enviar.put<{ ok: boolean }>(`/v1/site/paginas/${encodeURIComponent(pagina)}/publicar`, { dados });
export const apiImagemSite = (ficheiro: File) => enviarFicheiro<{ nome: string; url: string }>("/v1/site/imagem", ficheiro);
