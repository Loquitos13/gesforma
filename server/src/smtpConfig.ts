import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { openSecret, sealSecret } from "./secretBox.js";
import { isEmail, normalizeEmail, sanitizeHeader } from "./security.js";

export const BREVO_SMTP_HOST = "smtp-relay.brevo.com";
export const BREVO_SMTP_PORT = 587;

type Row = {
  host: string | null;
  port: number | null;
  login: string | null;
  password_sealed: string | null;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
};

export type SmtpCreds = {
  host: string;
  port: number;
  login: string;
  password: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  fromEnv: boolean;
};

export type SmtpTransport =
  | { kind: "log" }
  | { kind: "url"; url: string; from: string; replyTo?: string }
  | {
      kind: "smtp";
      host: string;
      port: number;
      user: string;
      pass: string;
      from: string;
      replyTo?: string;
    };

export function smtpConfigured(t: SmtpTransport) {
  return t.kind === "url" || t.kind === "smtp";
}

function parseSmtpUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname || BREVO_SMTP_HOST,
      port: u.port ? Number(u.port) : (u.protocol === "smtps:" ? 465 : BREVO_SMTP_PORT),
      login: decodeURIComponent(u.username || ""),
    };
  } catch {
    return { host: BREVO_SMTP_HOST, port: BREVO_SMTP_PORT, login: "" };
  }
}

function parseFromHeader(raw: string) {
  const m = raw.match(/^(.*)<([^>]+)>\s*$/);
  if (m) {
    return { name: sanitizeHeader(m[1] ?? "").replace(/^"|"$/g, ""), email: normalizeEmail(m[2] ?? "") };
  }
  return { name: "", email: normalizeEmail(raw) };
}

export async function smtpCreds(db: Db): Promise<SmtpCreds> {
  const row = await db.query<Row>(
    "SELECT host, port, login, password_sealed, from_name, from_email, reply_to FROM smtp_config WHERE id = 'brevo'",
  );
  const stored = row.rows[0];
  let storedPassword = "";
  if (stored?.password_sealed) {
    try { storedPassword = openSecret(stored.password_sealed); } catch { storedPassword = ""; }
  }
  if (config.smtpUrl) {
    const parsed = parseSmtpUrl(config.smtpUrl);
    const from = parseFromHeader(config.mailFrom);
    return {
      host: parsed.host,
      port: Number.isInteger(parsed.port) && parsed.port > 0 ? parsed.port : BREVO_SMTP_PORT,
      login: parsed.login,
      password: "env",
      fromName: from.name || "ENA Formação",
      fromEmail: from.email,
      replyTo: config.mailReplyTo,
      fromEnv: true,
    };
  }
  const portRaw = Number(stored?.port);
  const port = Number.isInteger(portRaw) && portRaw > 0 ? portRaw : BREVO_SMTP_PORT;
  return {
    host: (stored?.host || BREVO_SMTP_HOST).trim() || BREVO_SMTP_HOST,
    port,
    login: (stored?.login || "").trim(),
    password: storedPassword,
    fromName: (stored?.from_name || "ENA Formação").trim() || "ENA Formação",
    fromEmail: normalizeEmail(stored?.from_email || ""),
    replyTo: normalizeEmail(stored?.reply_to || ""),
    fromEnv: false,
  };
}

export function smtpTransportFromCreds(creds: SmtpCreds): SmtpTransport {
  if (creds.fromEnv && config.smtpUrl) {
    return {
      kind: "url",
      url: config.smtpUrl,
      from: config.mailFrom,
      replyTo: config.mailReplyTo || undefined,
    };
  }
  if (creds.login && creds.password && creds.fromEmail) {
    const from = creds.fromName
      ? `${sanitizeHeader(creds.fromName)} <${creds.fromEmail}>`
      : creds.fromEmail;
    return {
      kind: "smtp",
      host: creds.host || BREVO_SMTP_HOST,
      port: creds.port || BREVO_SMTP_PORT,
      user: creds.login,
      pass: creds.password,
      from,
      replyTo: creds.replyTo || undefined,
    };
  }
  return { kind: "log" };
}

export async function resolveSmtpTransport(db: Db): Promise<SmtpTransport> {
  return smtpTransportFromCreds(await smtpCreds(db));
}

export async function getSmtpStatus(db: Db) {
  const creds = await smtpCreds(db);
  const transport = smtpTransportFromCreds(creds);
  const configured = smtpConfigured(transport);
  return {
    configured,
    fromEnv: creds.fromEnv,
    hasPassword: Boolean(creds.password),
    host: creds.host,
    port: creds.port,
    login: creds.login,
    fromName: creds.fromName,
    fromEmail: creds.fromEmail,
    replyTo: creds.replyTo,
    hint: creds.fromEnv
      ? "SMTP definido por SMTP_URL no servidor. As alterações nesta página não se aplicam."
      : configured
        ? "Os emails automáticos saem pela Brevo. As respostas vão para o email de redireccionamento."
        : "Na Brevo: Transactional → SMTP & API → SMTP. Cole o login SMTP e a chave, o remetente dos automáticos e o email para as respostas.",
  };
}

export async function saveSmtpConfig(db: Db, patch: {
  host?: string;
  port?: number;
  login: string;
  smtpKey?: string;
  fromName?: string;
  fromEmail: string;
  replyTo: string;
}) {
  const prev = await smtpCreds(db);
  if (prev.fromEnv) throw new Error("SMTP definido no servidor (SMTP_URL)");
  const host = sanitizeHeader(patch.host || prev.host || BREVO_SMTP_HOST) || BREVO_SMTP_HOST;
  const port = patch.port ?? prev.port ?? BREVO_SMTP_PORT;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Porta SMTP inválida");
  const login = patch.login.trim();
  if (login.length < 3) throw new Error("Login SMTP da Brevo em falta");
  const smtpKey = (patch.smtpKey ?? "").trim() || prev.password;
  if (smtpKey.length < 8) throw new Error("Chave SMTP da Brevo em falta");
  const fromEmail = normalizeEmail(patch.fromEmail);
  const replyTo = normalizeEmail(patch.replyTo);
  if (!isEmail(fromEmail)) throw new Error("Email dos envios automáticos inválido");
  if (!isEmail(replyTo)) throw new Error("Email para redireccionar respostas inválido");
  const fromName = sanitizeHeader(patch.fromName ?? prev.fromName) || "ENA Formação";
  await db.query(
    `INSERT INTO smtp_config (id, host, port, login, password_sealed, from_name, from_email, reply_to)
     VALUES ('brevo', $1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       host = EXCLUDED.host,
       port = EXCLUDED.port,
       login = EXCLUDED.login,
       password_sealed = EXCLUDED.password_sealed,
       from_name = EXCLUDED.from_name,
       from_email = EXCLUDED.from_email,
       reply_to = EXCLUDED.reply_to,
       updated_at = now()`,
    [host, port, login, sealSecret(smtpKey), fromName, fromEmail, replyTo],
  );
  return smtpCreds(db);
}

export async function disconnectSmtp(db: Db) {
  await db.query("DELETE FROM smtp_config WHERE id = 'brevo'");
}
