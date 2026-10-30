import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { config, defaultDevSecret } from "./config.js";

const VERSION = "v1";
const IV_LEN = 12;

function chaveAtual(): Buffer {
  const raw = config.dataEncryptionKey;
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("DATA_ENCRYPTION_KEY tem de ser 32 bytes em base64.");
    return buf;
  }
  if (config.isProd && !process.env.VERCEL) {
    throw new Error("Falta DATA_ENCRYPTION_KEY em produção.");
  }
  return derivar(config.sessionSecret);
}

function derivar(segredo: string) {
  return createHash("sha256").update(segredo).digest();
}

let chaveiroCache: { id: string; chaves: Buffer[] } | null = null;

/**
 * Chaveiro: a primeira chave cifra; todas decifram. Inclui as chaves derivadas
 * do segredo de sessão (atual, antigo e o de desenvolvimento), para que definir
 * DATA_ENCRYPTION_KEY depois não torne ilegíveis os dados já cifrados.
 */
export function chaveiro(): Buffer[] {
  const id = [config.dataEncryptionKey, ...config.legacyDataEncryptionKeys, config.sessionSecret, config.legacySessionSecret].join("|");
  if (chaveiroCache?.id === id) return chaveiroCache.chaves;
  const lista = [chaveAtual()];
  // Chaves de cifra antigas (por exemplo, a da instalação anterior): só servem para ler.
  for (const k of config.legacyDataEncryptionKeys) {
    const buf = Buffer.from(k, "base64");
    if (buf.length === 32) lista.push(buf);
  }
  for (const segredo of [config.sessionSecret, config.legacySessionSecret, defaultDevSecret]) {
    if (segredo) lista.push(derivar(segredo));
  }
  const vistas = new Set<string>();
  const chaves = lista.filter(k => {
    const h = k.toString("hex");
    if (vistas.has(h)) return false;
    vistas.add(h);
    return true;
  });
  chaveiroCache = { id, chaves };
  return chaves;
}

/** Cifra texto UTF-8 (AES-256-GCM). Formato: v1:<iv>:<tag>:<data> (base64url). */
export function encryptField(plain: string): string {
  const text = plain ?? "";
  if (!text) return "";
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", chaveiro()[0]!, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const b64 = (b: Buffer) => b.toString("base64url");
  return `${VERSION}:${b64(iv)}:${b64(tag)}:${b64(enc)}`;
}

function partes(stored: string) {
  const parts = stored.split(":");
  if (parts.length !== 4) return null;
  return {
    iv: Buffer.from(parts[1]!, "base64url"),
    tag: Buffer.from(parts[2]!, "base64url"),
    data: Buffer.from(parts[3]!, "base64url"),
  };
}

function abrirComChaveiro(iv: Buffer, tag: Buffer, data: Buffer) {
  let ultimo: unknown;
  const chaves = chaveiro();
  for (let i = 0; i < chaves.length; i++) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", chaves[i]!, iv);
      decipher.setAuthTag(tag);
      return { texto: Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8"), atual: i === 0 };
    } catch (err) {
      ultimo = err;
    }
  }
  // A mensagem do Node («Unsupported state or unable to authenticate data») não diz nada a quem a vê.
  throw new Error("Dados pessoais cifrados com uma chave que este servidor não tem (defina DATA_ENCRYPTION_KEY_LEGACY com a chave anterior).", { cause: ultimo });
}

export function decryptField(stored: string): string {
  if (!stored?.trim()) return "";
  if (!stored.startsWith(`${VERSION}:`)) return stored;
  const p = partes(stored);
  if (!p) return "";
  return abrirComChaveiro(p.iv, p.tag, p.data).texto;
}

/**
 * Devolve o valor recifrado com a chave atual, ou null se já está na chave atual
 * (ou não é um valor cifrado). Lança se nenhuma chave o abre.
 */
export function recifrarCampo(stored: string): string | null {
  if (!stored?.startsWith(`${VERSION}:`)) return null;
  const p = partes(stored);
  if (!p) return null;
  const aberto = abrirComChaveiro(p.iv, p.tag, p.data);
  return aberto.atual ? null : encryptField(aberto.texto);
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
