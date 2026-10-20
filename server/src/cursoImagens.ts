import { randomBytes } from "node:crypto";
import type { Db } from "./db/pool.js";
import * as repo from "./repos/imagens.js";

const SLOTS = new Set(["banner", "thumb", "capa", "miniatura"]);
const MAX_BYTES = 8 * 1024 * 1024;

export function slotImagem(value: string) {
  return SLOTS.has(value) ? value as "banner" | "thumb" | "capa" | "miniatura" : null;
}

export function tokenImagem(value: string) {
  return /^[A-Za-z0-9_-]{16,80}$/.test(value) ? value : null;
}

export function urlImagemPublica(token: string, versao?: string | Date | null) {
  const base = `/api/v1/public/imagens/${token}`;
  if (!versao) return base;
  const v = versao instanceof Date ? versao.getTime() : Date.parse(String(versao));
  return Number.isFinite(v) ? `${base}?v=${v}` : base;
}

const URL_COM_ID = /\/(?:gold|fin)\/\d+(?:\/|$)/;

/** Tipo real da imagem pelos primeiros bytes (o MIME enviado pelo browser não conta). */
export function mimeDosBytes(b: Buffer): string | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (b.length > 6 && /^GIF8[79]a$/.test(b.subarray(0, 6).toString("latin1"))) return "image/gif";
  return null;
}

export async function guardarImagemCurso(
  db: Db,
  regime: "gold" | "fin",
  cursoId: number,
  slot: "banner" | "thumb" | "capa" | "miniatura",
  file: { nome: string; mime: string; bytes: Buffer },
) {
  if (file.bytes.length > MAX_BYTES) throw new Error("A imagem passa de 8 MB.");
  const mime = mimeDosBytes(file.bytes);
  if (!mime) throw new Error("Use JPG, PNG, WebP ou GIF.");
  const nome = file.nome.replace(/[^\w.\- ()]/g, "").slice(0, 180) || `${slot}.jpg`;
  const gravado = await repo.gravarImagemCurso(db, { regime, cursoId, slot, nome, mime, bytes: file.bytes, token: randomBytes(18).toString("base64url") });
  if (slot === "capa") await repo.apagarMiniatura(db, regime, cursoId);
  const url = urlImagemPublica(gravado?.token ?? "", gravado?.updated_at ?? new Date());
  await repo.ligarImagemNaFicha(db, regime, cursoId, slot, nome, url);
  return { nome, url };
}

const HERO_CURSO_ID = { "1": -91001, "2": -91002, fundo: -91003, apresentacao: -91004 } as const;

export async function guardarImagemHero(
  db: Db,
  slot: keyof typeof HERO_CURSO_ID,
  file: { nome: string; mime: string; bytes: Buffer },
) {
  if (file.bytes.length > MAX_BYTES) throw new Error("A imagem passa de 8 MB.");
  const mime = mimeDosBytes(file.bytes);
  if (!mime) throw new Error("Use JPG, PNG, WebP ou GIF.");
  const nome = file.nome.replace(/[^\w.\- ()]/g, "").slice(0, 180) || "hero.jpg";
  const token = randomBytes(18).toString("base64url");
  // O topo do site guarda-se como "curso" negativo no slot thumb.
  const gravado = await repo.gravarImagemCurso(db, { regime: "gold", cursoId: HERO_CURSO_ID[slot], slot: "thumb", nome, mime, bytes: file.bytes, token });
  return { nome, url: urlImagemPublica(gravado?.token || token, gravado?.updated_at ?? new Date()) };
}

export async function guardarImagemBlog(
  db: Db,
  file: { nome: string; mime: string; bytes: Buffer },
) {
  if (file.bytes.length > MAX_BYTES) throw new Error("A imagem passa de 8 MB.");
  const mime = mimeDosBytes(file.bytes);
  if (!mime) throw new Error("Use JPG, PNG, WebP ou GIF.");
  const nome = file.nome.replace(/[^\w.\- ()]/g, "").slice(0, 180) || "imagem.jpg";
  const token = randomBytes(18).toString("base64url");
  await repo.gravarImagemBlog(db, { token, nome, mime, bytes: file.bytes });
  return { nome, url: urlImagemPublica(token) };
}

export async function lerImagemPorToken(db: Db, token: string) {
  const found = await repo.imagemPorToken(db, token);
  if (!found) return null;
  const bytes = bytesDe(found.bytes);
  if (!bytes?.length) return null;
  return { mime: found.mime || "image/jpeg", bytes };
}

export async function mapaImagensPublicas(db: Db) {
  const rows = await repo.todasImagensCurso(db);
  const mapa = new Map<string, string>();
  for (const row of rows) {
    if (Number(row.curso_id) <= 0) continue;
    if (row.regime !== "gold" && row.regime !== "fin") continue;
    if (row.slot !== "banner" && row.slot !== "thumb" && row.slot !== "capa" && row.slot !== "miniatura") continue;
    if (!tokenImagem(row.token)) continue;
    mapa.set(`${row.regime}:${row.curso_id}:${row.slot}`, urlImagemPublica(row.token, row.updated_at));
  }
  return mapa;
}

export async function urlsImagemDoCurso(db: Db, regime: "gold" | "fin", cursoId: number) {
  const rows = await repo.imagensDoCurso(db, regime, cursoId);
  const mapa = new Map<"banner" | "thumb" | "capa" | "miniatura", string>();
  for (const row of rows) {
    const slot = slotImagem(row.slot);
    if (!slot || !tokenImagem(row.token)) continue;
    mapa.set(slot, urlImagemPublica(row.token, row.updated_at));
  }
  return mapa;
}

export function semIdNaMedia(payload: Record<string, unknown>, urls: Map<"banner" | "thumb" | "capa" | "miniatura", string>) {
  const next = { ...payload };
  for (const slot of ["banner", "thumb", "capa", "miniatura"] as const) {
    const media = mediaDe(next[slot]);
    const publica = urls.get(slot);
    if (publica) {
      next[slot] = { name: media.name, url: publica };
      continue;
    }
    if (media.url && URL_COM_ID.test(media.url)) next[slot] = { name: media.name, url: "" };
  }
  return next;
}

function mediaDe(value: unknown) {
  if (!value || typeof value !== "object") return { name: "", url: "" };
  const media = value as { name?: unknown; url?: unknown };
  return {
    name: typeof media.name === "string" ? media.name : "",
    url: typeof media.url === "string" ? media.url : "",
  };
}

function bytesDe(value: unknown) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (typeof value === "string") {
    if (value.startsWith("\\x")) return Buffer.from(value.slice(2), "hex");
    return Buffer.from(value, "base64");
  }
  return null;
}
