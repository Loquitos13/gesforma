import { one, type Consulta } from "./sql.js";

/** Configuração das integrações guardada na base (os segredos vêm já selados por secretBox). */

export type SmtpGuardado = {
  host: string | null; port: number | null; login: string | null; password_sealed: string | null;
  from_name: string | null; from_email: string | null; reply_to: string | null;
};

export function smtpGuardado(c: Consulta) {
  return one<SmtpGuardado>(c, "SELECT host, port, login, password_sealed, from_name, from_email, reply_to FROM smtp_config WHERE id = 'brevo'");
}

export async function gravarSmtp(c: Consulta, s: { host: string; port: number; login: string; passwordSealed: string; fromName: string; fromEmail: string; replyTo: string }) {
  await one(
    c,
    `INSERT INTO smtp_config (id, host, port, login, password_sealed, from_name, from_email, reply_to)
     VALUES ('brevo', $1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET host = EXCLUDED.host, port = EXCLUDED.port, login = EXCLUDED.login,
       password_sealed = EXCLUDED.password_sealed, from_name = EXCLUDED.from_name, from_email = EXCLUDED.from_email,
       reply_to = EXCLUDED.reply_to, updated_at = now()`,
    [s.host, s.port, s.login, s.passwordSealed, s.fromName, s.fromEmail, s.replyTo],
  );
}

export async function apagarSmtp(c: Consulta) {
  await one(c, "DELETE FROM smtp_config WHERE id = 'brevo'");
}

export function microsoftGuardado(c: Consulta) {
  return one<{ client_id: string | null; client_secret: string | null; tenant_id: string | null }>(
    c, "SELECT client_id, client_secret, tenant_id FROM microsoft_config WHERE id = 'microsoft'",
  );
}

export async function gravarMicrosoft(c: Consulta, m: { clientId: string; secretSealed: string; tenantId: string }) {
  await one(
    c,
    `INSERT INTO microsoft_config (id, client_id, client_secret, tenant_id) VALUES ('microsoft', $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET client_id = EXCLUDED.client_id, client_secret = EXCLUDED.client_secret,
       tenant_id = EXCLUDED.tenant_id, updated_at = now()`,
    [m.clientId, m.secretSealed, m.tenantId],
  );
}

export async function apagarMicrosoft(c: Consulta) {
  await one(c, "DELETE FROM microsoft_config WHERE id = 'microsoft'");
}
