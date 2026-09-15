import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEYLEN = 32;

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function derive(password: string, salt: string, n: number, r: number, p: number) {
  return scryptSync(password, salt, KEYLEN, { N: n, r, p });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const key = derive(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  try {
    const [algo, n, r, p, salt, hex] = stored.split("$");
    if (algo !== "scrypt" || !salt || !hex) return false;
    const key = derive(password, salt, Number(n), Number(r), Number(p));
    const expected = Buffer.from(hex, "hex");
    if (expected.length !== key.length) return false;
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export function isEmail(raw: string) {
  return EMAIL_RE.test(normalizeEmail(raw)) && raw.length <= 254 && !/[\r\n]/.test(raw);
}

export function sanitizeHeader(value: string) {
  return value.replace(/[\r\n\0]/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
}

export function sanitizeText(value: string, max = 4000) {
  return value.replace(/\0/g, "").slice(0, max);
}

export function fillVars(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => sanitizeHeader(vars[k] ?? ""));
}

export function delaySecondsFromLabel(label: string) {
  switch (label) {
    case "Imediatamente": return 0;
    case "1 hora depois": return 3600;
    case "24 horas depois": return 86400;
    case "3 dias depois": return 259200;
    default: return 0;
  }
}

export function delayLabelFromSeconds(sec: number) {
  if (sec >= 259200) return "3 dias depois";
  if (sec >= 86400) return "24 horas depois";
  if (sec >= 3600) return "1 hora depois";
  return "Imediatamente";
}

export const TRIGGER_MAP: Record<string, string> = {
  "Nova pré-inscrição recebida": "preinscricao.created",
  "Pré-inscrição sem pagamento há 3 dias": "preinscricao.unpaid_3d",
  "Pagamento confirmado": "payment.confirmed",
  "Contacto após a venda": "sale.followup",
  "24 horas antes do início": "turma.starts_in_24h",
  "Formando marcado como concluído": "formando.completed",
  "30 dias sem compra": "lead.stale_30d",
  "Sumário da sessão assinado": "sessao.summary_signed",
};

export const EVENT_ALIASES: Record<string, string[]> = {
  "preinscricao.created": ["preinscricao.created"],
  "payment.confirmed": ["payment.confirmed", "sale.followup"],
  "sale.followup": ["sale.followup"],
  "formando.completed": ["formando.completed"],
  "sessao.summary_signed": ["sessao.summary_signed"],
  "preinscricao.unpaid_3d": ["preinscricao.unpaid_3d"],
  "turma.starts_in_24h": ["turma.starts_in_24h"],
  "lead.stale_30d": ["lead.stale_30d"],
};
