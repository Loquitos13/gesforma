// API do domínio "blog": publicações do site (notícias) e imagens do corpo.
import { api, enviar, enviarFicheiro, qs } from "./cliente";

export type Post = { id: number; titulo: string; slug: string; data: string; status: string; tematica: string; corpo: string };
export type FiltroPosts = { q?: string; estado?: string; tematica?: string; ordem?: string };

export const apiPosts = (f: FiltroPosts, signal?: AbortSignal) =>
  api<{ posts: Post[]; resumo: { total: number; ativos: number } }>(`/v1/blog${qs(f)}`, { signal, silencioso: true });

export const apiCriarPost = (d: Omit<Post, "id">) => enviar.post<{ post: Post }>("/v1/blog", d);
export const apiEditarPost = (id: number, d: Partial<Omit<Post, "id">>) => enviar.patch<{ post: Post }>(`/v1/blog/${id}`, d);
export const apiApagarPost = (id: number) => enviar.delete<{ ok: boolean }>(`/v1/blog/${id}`);
export const apiImagemBlog = (ficheiro: File) => enviarFicheiro<{ nome: string; url: string }>("/v1/blog/imagem", ficheiro);
