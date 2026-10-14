import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { config, defaultDevSecret } from "./config.js";

const cacheChaves = new Map<string, Buffer>();

function chaveDe(segredo: string) {
  let k = cacheChaves.get(segredo);
  if (!k) {
    k = scryptSync(segredo, "gesforma-drive-v1", 32);
    cacheChaves.set(segredo, k);
  }
  return k;
}

/** A primeira chave sela; todas abrem (segredo atual, antigo e o de desenvolvimento). */
function chaves(): Buffer[] {
  const segredos = [config.sessionSecret, config.legacySessionSecret, defaultDevSecret].filter(Boolean);
  return [...new Set(segredos)].map(chaveDe);
}

export function sealSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", chaves()[0]!, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function abrir(sealed: string) {
  const buf = Buffer.from(sealed, "base64url");
  if (buf.length < 29) throw new Error("segredo inválido");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  let ultimo: unknown;
  const lista = chaves();
  for (let i = 0; i < lista.length; i++) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", lista[i]!, iv);
      decipher.setAuthTag(tag);
      return { texto: Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8"), atual: i === 0 };
    } catch (err) {
      ultimo = err;
    }
  }
  throw ultimo ?? new Error("segredo inválido");
}

export function openSecret(sealed: string) {
  return abrir(sealed).texto;
}

/** Devolve o segredo selado de novo com a chave atual, ou null se já está na chave atual. */
export function resselarSegredo(sealed: string): string | null {
  if (!sealed) return null;
  const aberto = abrir(sealed);
  return aberto.atual ? null : sealSecret(aberto.texto);
}
