import { randomBytes } from "node:crypto";
import type { Db } from "./db/pool.js";

const SLOTS = new Set(["banner", "thumb"]);
const MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;

export function slotImagem(value: string) {
  return SLOTS.has(value) ? value as "banner" | "thumb" : null;
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

export function mimeImagem(value: string) {
  const mime = value.toLowerCase().split(";")[0]?.trim() ?? "";
  return MIMES.has(mime) ? mime : null;
}

export async function guardarImagemCurso(
  db: Db,
  regime: "gold" | "fin",
  cursoId: number,
  slot: "banner" | "thumb",
  file: { nome: string; mime: string; bytes: Buffer },
) {
  if (file.bytes.length > MAX_BYTES) throw new Error("A imagem passa de 8 MB.");
  const mime = mimeImagem(file.mime);
  if (!mime) throw new Error("Use JPG, PNG, WebP ou GIF.");
  const nome = file.nome.replace(/[^\w.\- ()]/g, "").slice(0, 180) || `${slot}.jpg`;
  const token = randomBytes(18).toString("base64url");
  await db.query(
    `INSERT INTO curso_imagens (regime, curso_id, slot, nome, mime, bytes, token, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (regime, curso_id, slot) DO UPDATE SET
       nome = EXCLUDED.nome,
       mime = EXCLUDED.mime,
       bytes = EXCLUDED.bytes,
       token = COALESCE(NULLIF(curso_imagens.token, ''), EXCLUDED.token),
       updated_at = now()`,
    [regime, cursoId, slot, nome, mime, file.bytes, token],
  );
  const row = await db.query<{ token: string; updated_at: string | Date }>(
    "SELECT token, updated_at FROM curso_imagens WHERE regime = $1 AND curso_id = $2 AND slot = $3",
    [regime, cursoId, slot],
  );
  const gravado = row.rows[0];
  const url = urlImagemPublica(gravado?.token || token, gravado?.updated_at ?? new Date());
  await db.query(
    `INSERT INTO curso_fichas (regime, curso_id, payload)
     VALUES ($1, $2, jsonb_build_object($3::text, jsonb_build_object('name', $4::text, 'url', $5::text)))
     ON CONFLICT (regime, curso_id) DO UPDATE SET
       payload = COALESCE(curso_fichas.payload, '{}'::jsonb) || jsonb_build_object($3::text, jsonb_build_object('name', $4::text, 'url', $5::text)),
       updated_at = now()`,
    [regime, cursoId, slot, nome, url],
  );
  return { nome, url };
}

export async function lerImagemPorToken(db: Db, token: string) {
  const row = await db.query<{ mime: string; bytes: unknown }>(
    "SELECT mime, bytes FROM curso_imagens WHERE token = $1",
    [token],
  );
  const found = row.rows[0];
  if (!found) return null;
  const bytes = bytesDe(found.bytes);
  if (!bytes?.length) return null;
  return { mime: found.mime || "image/jpeg", bytes };
}

export async function mapaImagensPublicas(db: Db) {
  const rows = await db.query<{ regime: string; curso_id: number; slot: string; token: string; updated_at: string | Date }>(
    "SELECT regime, curso_id, slot, token, updated_at FROM curso_imagens",
  );
  const mapa = new Map<string, string>();
  for (const row of rows.rows) {
    if (row.regime !== "gold" && row.regime !== "fin") continue;
    if (row.slot !== "banner" && row.slot !== "thumb") continue;
    if (!tokenImagem(row.token)) continue;
    mapa.set(`${row.regime}:${row.curso_id}:${row.slot}`, urlImagemPublica(row.token, row.updated_at));
  }
  return mapa;
}

export async function urlsImagemDoCurso(db: Db, regime: "gold" | "fin", cursoId: number) {
  const rows = await db.query<{ slot: string; token: string; updated_at: string | Date }>(
    "SELECT slot, token, updated_at FROM curso_imagens WHERE regime = $1 AND curso_id = $2",
    [regime, cursoId],
  );
  const mapa = new Map<"banner" | "thumb", string>();
  for (const row of rows.rows) {
    const slot = slotImagem(row.slot);
    if (!slot || !tokenImagem(row.token)) continue;
    mapa.set(slot, urlImagemPublica(row.token, row.updated_at));
  }
  return mapa;
}

export function semIdNaMedia(payload: Record<string, unknown>, urls: Map<"banner" | "thumb", string>) {
  const next = { ...payload };
  for (const slot of ["banner", "thumb"] as const) {
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
