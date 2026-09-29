import nodemailer from "nodemailer";
import type { Db } from "./db/pool.js";
import { resolveSmtpTransport, smtpConfigured } from "./smtpConfig.js";
import { sanitizeHeader } from "./security.js";

type SendInput = { to: string; name: string; subject: string; text: string; html?: string };

export async function sendMail(db: Db, input: SendInput) {
  const to = sanitizeHeader(input.to);
  const subject = sanitizeHeader(input.subject);
  const text = input.text.replace(/\0/g, "");
  const transport = await resolveSmtpTransport(db);
  if (!smtpConfigured(transport)) {
    console.info(`[mail:log] para=${to} assunto=${subject}`);
    return `log:${Date.now()}`;
  }
  const mailer = transport.kind === "url"
    ? nodemailer.createTransport(transport.url)
    : nodemailer.createTransport({
        host: transport.host,
        port: transport.port,
        secure: transport.port === 465,
        auth: { user: transport.user, pass: transport.pass },
      });
  const info = await mailer.sendMail({
    from: transport.from,
    replyTo: transport.replyTo || undefined,
    to: `${sanitizeHeader(input.name)} <${to}>`,
    subject,
    text,
    html: input.html,
  });
  return info.messageId ?? "smtp";
}
