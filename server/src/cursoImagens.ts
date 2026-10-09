import type { Db } from "./db/pool.js";

const SLOTS = new Set(["banner", "thumb"]);
const MIMES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 8 * 1024 * 1024;

export function slotImagem(value: string) {
  return SLOTS.has(value) ? value as "banner" | "thumb" : null;
}

export function urlImagemCurso(regime: "gold" | "fin", cursoId: number, slot: "banner" | "thumb", versao?: string | Date | null) {
  const base = `/api/v1/public/cursos/${regime}/${cursoId}/imagem/${slot}`;
  if (!versao) return base;
  const v = versao instanceof Date ? versao.getTime() : Date.parse(String(versao));
  return Number.isFinite(v) ? `${base}?v=${v}` : base;
}

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
  await db.query(
    `INSERT INTO curso_imagens (regime, curso_id, slot, nome, mime, bytes, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (regime, curso_id, slot) DO UPDATE SET
       nome = EXCLUDED.nome,
       mime = EXCLUDED.mime,
       bytes = EXCLUDED.bytes,
       updated_at = now()`,
    [regime, cursoId, slot, nome, mime, file.bytes],
  );
  const row = await db.query<{ updated_at: string | Date }>(
    "SELECT updated_at FROM curso_imagens WHERE regime = $1 AND curso_id = $2 AND slot = $3",
    [regime, cursoId, slot],
  );
  const url = urlImagemCurso(regime, cursoId, slot, row.rows[0]?.updated_at ?? new Date());
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

export async function lerImagemCurso(db: Db, regime: "gold" | "fin", cursoId: number, slot: "banner" | "thumb") {
  const row = await db.query<{ mime: string; bytes: unknown; nome: string }>(
    "SELECT mime, bytes, nome FROM curso_imagens WHERE regime = $1 AND curso_id = $2 AND slot = $3",
    [regime, cursoId, slot],
  );
  const found = row.rows[0];
  if (!found) return null;
  const bytes = bytesDe(found.bytes);
  if (!bytes?.length) return null;
  return { mime: found.mime || "image/jpeg", bytes, nome: found.nome };
}

export async function mapaImagensPublicas(db: Db) {
  const rows = await db.query<{ regime: string; curso_id: number; slot: string; updated_at: string | Date }>(
    "SELECT regime, curso_id, slot, updated_at FROM curso_imagens",
  );
  const mapa = new Map<string, string>();
  for (const row of rows.rows) {
    if (row.regime !== "gold" && row.regime !== "fin") continue;
    if (row.slot !== "banner" && row.slot !== "thumb") continue;
    mapa.set(`${row.regime}:${row.curso_id}:${row.slot}`, urlImagemCurso(row.regime, Number(row.curso_id), row.slot, row.updated_at));
  }
  return mapa;
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
