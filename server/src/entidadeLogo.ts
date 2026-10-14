import { createHash } from "node:crypto";
import type { Consulta } from "./repos/sql.js";
import * as repo from "./repos/entidadeLogo.js";

/** Logótipo da entidade: PNG ou JPG (são os formatos que os PDF e os clientes de email aceitam). */

export const LOGO_MAX_BYTES = 1024 * 1024;

export class LogoErro extends Error {}

/** Tipo real pelos primeiros bytes; o MIME enviado pelo browser não conta. */
export function mimeLogo(b: Buffer): "image/png" | "image/jpeg" | null {
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  return null;
}

function bytesDe(v: unknown): Buffer {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  if (typeof v === "string" && v.startsWith("\\x")) return Buffer.from(v.slice(2), "hex");
  return Buffer.alloc(0);
}

/** Logótipo guardado, ou null se a entidade ainda não carregou nenhum. */
export async function obterLogoEntidade(db: Consulta): Promise<{ bytes: Buffer; mime: string } | null> {
  const r = await repo.lerLogo(db);
  if (!r) return null;
  const bytes = bytesDe(r.bytes);
  return bytes.length ? { bytes, mime: r.mime } : null;
}

export async function infoLogoEntidade(db: Consulta) {
  const r = await repo.infoLogo(db);
  return r ? { nome: r.nome, mime: r.mime, versao: r.hash.slice(0, 12), actualizado: r.updated_at, tamanho: r.tamanho } : null;
}

export async function guardarLogoEntidade(db: Consulta, file: { nome: string; bytes: Buffer }) {
  if (!file.bytes.length) throw new LogoErro("O ficheiro está vazio.");
  if (file.bytes.length > LOGO_MAX_BYTES) throw new LogoErro("O logótipo passa de 1 MB.");
  const mime = mimeLogo(file.bytes);
  if (!mime) throw new LogoErro("Use uma imagem PNG ou JPG.");
  const ext = mime === "image/png" ? "png" : "jpg";
  const base = file.nome.replace(/\.[^.]+$/, "").replace(/[^\w\- ()]/g, "").trim().slice(0, 120) || "logotipo";
  const hash = createHash("sha256").update(file.bytes).digest("hex");
  await repo.gravarLogo(db, { nome: `${base}.${ext}`, mime, bytes: file.bytes, hash });
  return infoLogoEntidade(db);
}

export async function apagarLogoEntidade(db: Consulta) {
  await repo.apagarLogo(db);
}

/** Endereço público do logótipo (sem logótipo carregado, responde com o logótipo ENA do site). */
export function urlLogoPublico(origin: string) {
  return `${origin.replace(/\/$/, "")}/api/v1/public/entidade/logo`;
}
