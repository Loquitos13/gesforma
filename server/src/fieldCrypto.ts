import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config } from "./config.js";

const VERSION = "v1";
const IV_LEN = 12;

function masterKey(): Buffer {
  const raw = config.dataEncryptionKey;
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("DATA_ENCRYPTION_KEY tem de ser 32 bytes em base64.");
    return buf;
  }
  if (config.isProd && !process.env.VERCEL) {
    throw new Error("Falta DATA_ENCRYPTION_KEY em produção.");
  }
  return createHash("sha256").update(config.sessionSecret).digest();
}

/** Cifra texto UTF-8 (AES-256-GCM). Formato: v1:<iv>:<tag>:<data> (base64url). */
export function encryptField(plain: string): string {
  const text = plain ?? "";
  if (!text) return "";
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const b64 = (b: Buffer) => b.toString("base64url");
  return `${VERSION}:${b64(iv)}:${b64(tag)}:${b64(enc)}`;
}

export function decryptField(stored: string): string {
  if (!stored?.trim()) return "";
  if (!stored.startsWith(`${VERSION}:`)) return stored;
  const parts = stored.split(":");
  if (parts.length !== 4) return "";
  const iv = Buffer.from(parts[1]!, "base64url");
  const tag = Buffer.from(parts[2]!, "base64url");
  const data = Buffer.from(parts[3]!, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function encryptJson(value: unknown): string {
  return encryptField(JSON.stringify(value));
}

export function decryptJson<T>(stored: string): T | null {
  if (!stored?.trim()) return null;
  try {
    const raw = decryptField(stored);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Identificador opaco estável para expor fora da API interna (não é o id numérico). */
export function opaqueRef(kind: string, numericId: number | string, publicId?: string | null) {
  if (publicId && /^[0-9a-f-]{36}$/i.test(publicId)) return publicId;
  const payload = `${kind}:${numericId}`;
  const mac = createHash("sha256").update(`${config.sessionSecret}:ref:${payload}`).digest("base64url").slice(0, 22);
  return `ref_${mac}`;
}
