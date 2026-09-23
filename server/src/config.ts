import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";

function req(name: string, fallback?: string) {
  const v = process.env[name] ?? fallback;
  if (v == null || v === "") throw new Error(`Falta a variável ${name}`);
  return v;
}

function bool(name: string, fallback: boolean) {
  const v = process.env[name];
  if (v == null || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

const nodeEnv = process.env.NODE_ENV ?? "development";
export const isProd = nodeEnv === "production";
export const onVercel = Boolean(process.env.VERCEL);

const defaultDevSecret = "dev-only-not-for-production-gesforma-session-key-32";
const defaultDevPassword = "altere-me-no-primeiro-arranque";

export const config = {
  nodeEnv,
  isProd,
  port: Number(process.env.API_PORT ?? 43148),
  host: process.env.API_HOST ?? "0.0.0.0",
  appOrigin: process.env.APP_ORIGIN
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://127.0.0.1:43147"),
  sessionSecret: process.env.SESSION_SECRET ?? ((isProd && !process.env.VERCEL) ? "" : defaultDevSecret),
  sessionDays: Number(process.env.SESSION_DAYS ?? 7),
  cookieName: "gf_session",
  adminEmail: (process.env.ADMIN_EMAIL ?? "tania@ena.pt").trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD ?? ((isProd && !process.env.VERCEL) ? "" : defaultDevPassword),
  adminName: process.env.ADMIN_NAME ?? "Tania",
  mailMode: (process.env.MAIL_MODE ?? "log") as "log" | "smtp",
  smtpUrl: process.env.SMTP_URL ?? "",
  mailFrom: process.env.MAIL_FROM ?? "ENA Formação <formacao@ena.pt>",
  databaseUrl: process.env.DATABASE_URL ?? "",
  pgliteDir: process.env.PGLITE_DIR
    ?? (process.env.VERCEL ? "/tmp/gesforma-pglite" : fileURLToPath(new URL("../data/pglite", import.meta.url))),
  trustProxy: bool("TRUST_PROXY", Boolean(process.env.VERCEL)),
  cronSecret: process.env.CRON_SECRET ?? "",
};

export function allowedOrigins() {
  const origins = new Set<string>([config.appOrigin]);
  if (process.env.APP_ORIGIN) origins.add(process.env.APP_ORIGIN.replace(/\/$/, ""));
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (host) origins.add(`https://${host.replace(/^https?:\/\//, "")}`);
  }
  return origins;
}

export function assertSecureConfig() {
  if (onVercel && !config.databaseUrl) {
    console.warn("Vercel sem DATABASE_URL: a API usa PGlite em /tmp (some entre invocações). Ligue Neon ou Vercel Postgres.");
  }
  if (isProd && !onVercel) {
    if (!config.databaseUrl) throw new Error("Em produção é obrigatório DATABASE_URL (Postgres).");
    if (!process.env.SESSION_SECRET || config.sessionSecret.length < 32) {
      throw new Error("Em produção SESSION_SECRET tem de ter pelo menos 32 caracteres.");
    }
    if (!process.env.ADMIN_PASSWORD || config.adminPassword === defaultDevPassword) {
      throw new Error("Em produção defina ADMIN_PASSWORD (não use o valor de desenvolvimento).");
    }
  }
  if (onVercel && config.databaseUrl) {
    if (!process.env.SESSION_SECRET || config.sessionSecret.length < 32) {
      throw new Error("Com Postgres na Vercel, SESSION_SECRET tem de ter pelo menos 32 caracteres.");
    }
    if (!process.env.ADMIN_PASSWORD || config.adminPassword === defaultDevPassword) {
      throw new Error("Com Postgres na Vercel, defina ADMIN_PASSWORD (não use o valor de desenvolvimento).");
    }
  }
  if (config.sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET demasiado curto.");
  }
}

export function newToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}
