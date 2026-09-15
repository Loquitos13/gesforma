import nodemailer from "nodemailer";
import { config } from "./config.js";
import { sanitizeHeader } from "./security.js";

type SendInput = { to: string; name: string; subject: string; text: string };

export async function sendMail(input: SendInput) {
  const to = sanitizeHeader(input.to);
  const subject = sanitizeHeader(input.subject);
  const text = input.text.replace(/\0/g, "");
  if (config.mailMode === "smtp" && config.smtpUrl) {
    const transport = nodemailer.createTransport(config.smtpUrl);
    const info = await transport.sendMail({
      from: config.mailFrom,
      to: `${sanitizeHeader(input.name)} <${to}>`,
      subject,
      text,
    });
    return info.messageId ?? "smtp";
  }
  console.info(`[mail:log] para=${to} assunto=${subject}`);
  return `log:${Date.now()}`;
}
