import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { config } from "./config.js";

function key() {
  return scryptSync(config.sessionSecret, "gesforma-drive-v1", 32);
}

export function sealSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function openSecret(sealed: string) {
  const buf = Buffer.from(sealed, "base64url");
  if (buf.length < 29) throw new Error("segredo inválido");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
