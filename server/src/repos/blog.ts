/** Blog: publicações e o que o site público mostra. */
import { Filtros, many, one, ordenarPor, padraoPesquisa, valor, type Consulta } from "./sql.js";

export type Post = { id: number; titulo: string; slug: string; data: string; status: string; tematica: string; corpo: string };

export function mapPost(r: Record<string, unknown>): Post {
  return {
    id: Number(r.id ?? 0), titulo: String(r.titulo ?? ""), slug: String(r.slug ?? ""), data: String(r.data ?? ""),
    status: String(r.status ?? "Ativo"), tematica: String(r.tematica ?? ""), corpo: String(r.corpo ?? ""),
  };
}

export type FiltroPosts = { q?: string; estado?: string; tematica?: string; ordem?: string };

export async function listarPosts(c: Consulta, f: FiltroPosts = {}) {
  const w = new Filtros();
  const q = padraoPesquisa(f.q);
  w.add("(titulo ILIKE ? OR slug ILIKE ?)", q, q);
  w.add("status = ?", f.estado);
  w.add("tematica = ?", f.tematica);
  const ordem = ordenarPor({ data: "data", titulo: "titulo", estado: "status" }, f.ordem ?? "-data", "data DESC, id DESC");
  return (await many(c, `SELECT * FROM blog_posts ${w.where} ${ordem}`, w.params)).map(mapPost);
}

export async function resumoPosts(c: Consulta) {
  const r = await one(c, `SELECT count(*)::int AS total, count(*) FILTER (WHERE status = 'Ativo')::int AS ativos FROM blog_posts`);
  return { total: Number(r?.total ?? 0), ativos: Number(r?.ativos ?? 0) };
}

export async function obterPost(c: Consulta, id: number) {
  const r = await one(c, "SELECT * FROM blog_posts WHERE id = $1", [id]);
  return r ? mapPost(r) : null;
}

export async function slugOcupado(c: Consulta, slug: string, excetoId: number | null) {
  const n = await valor<number>(c, "SELECT count(*)::int FROM blog_posts WHERE slug = $1 AND ($2::int IS NULL OR id <> $2)", [slug, excetoId]);
  return Number(n ?? 0) > 0;
}

export async function criarPost(c: Consulta, d: Omit<Post, "id">) {
  const id = Number(await valor<number>(c, "SELECT nextval('ops_id_seq')::int AS id"));
  await many(c, "INSERT INTO blog_posts (id, titulo, slug, data, status, tematica, corpo) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [id, d.titulo, d.slug, d.data, d.status, d.tematica, d.corpo]);
  return id;
}

export async function actualizarPost(c: Consulta, id: number, d: Partial<Omit<Post, "id">>) {
  await many(c,
    `UPDATE blog_posts SET titulo = COALESCE($2, titulo), slug = COALESCE($3, slug), data = COALESCE($4, data),
       status = COALESCE($5, status), tematica = COALESCE($6, tematica), corpo = COALESCE($7, corpo) WHERE id = $1`,
    [id, d.titulo ?? null, d.slug ?? null, d.data ?? null, d.status ?? null, d.tematica ?? null, d.corpo ?? null]);
}

export async function apagarPost(c: Consulta, id: number) {
  await many(c, "DELETE FROM blog_posts WHERE id = $1", [id]);
}

// ── Site público ────────────────────────────────────────────────────────────

export async function noticiasPublicas(c: Consulta) {
  return many<{ titulo: string; slug: string; data: string; tematica: string; corpo: string }>(c,
    "SELECT titulo, slug, data, tematica, COALESCE(corpo, '') AS corpo FROM blog_posts WHERE status = 'Ativo' ORDER BY data DESC, id DESC");
}

export async function noticiaPublica(c: Consulta, slug: string) {
  return one<{ titulo: string; slug: string; data: string; tematica: string; corpo: string; status: string }>(c,
    "SELECT titulo, slug, data, tematica, COALESCE(corpo, '') AS corpo, status FROM blog_posts WHERE slug = $1", [slug]);
}

export async function outrasNoticias(c: Consulta, slug: string) {
  return many<{ titulo: string; slug: string; data: string; tematica: string }>(c,
    "SELECT titulo, slug, data, tematica FROM blog_posts WHERE status = 'Ativo' AND slug <> $1 ORDER BY data DESC LIMIT 3", [slug]);
}
