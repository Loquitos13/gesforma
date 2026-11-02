import nodemailer, { type Transporter } from "nodemailer";
import type { Db } from "./db/pool.js";
import { resolveSmtpTransport, smtpConfigured } from "./smtpConfig.js";
import { remetenteDoDestinatario } from "./remetenteLocal.js";
import { sanitizeHeader } from "./security.js";

type Anexo = { nome: string; tipo: string; conteudo: Buffer };
type SendInput = {
  to: string; name: string; subject: string; text: string; html?: string; anexos?: Anexo[];
  /** Remetente próprio (ex.: o email do local); as respostas vão para ele. Sem isto, o da configuração SMTP. */
  de?: { nome: string; email: string };
  /** Cópia oculta (ex.: para a caixa do remetente ficar com o registo do que se enviou). */
  bcc?: string;
  /** Sem o remetente do local da pessoa (ex.: o teste do SMTP): sai o da configuração. */
  semLocal?: boolean;
};

// Um transporte por configuração, reaproveitado entre envios (o cron manda vários seguidos). Com limites de tempo:
// um SMTP que não responde não pode prender a função da Vercel (30 s) até ela morrer a meio da fila.
const LIMITES = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000 };
let emCache: { chave: string; mailer: Transporter } | null = null;

export async function sendMail(db: Db, input: SendInput) {
  const to = sanitizeHeader(input.to);
  const subject = sanitizeHeader(input.subject);
  const text = input.text.replace(/\0/g, "");
  const transport = await resolveSmtpTransport(db);
  if (!smtpConfigured(transport)) {
    console.info(`[mail:log] para=${to} assunto=${subject}`);
    return `log:${Date.now()}`;
  }
  const chave = JSON.stringify(transport);
  if (emCache?.chave !== chave) {
    emCache = {
      chave,
      mailer: transport.kind === "url"
        ? nodemailer.createTransport({ url: transport.url, ...LIMITES })
        : nodemailer.createTransport({
            host: transport.host,
            port: transport.port,
            secure: transport.port === 465,
            auth: { user: transport.user, pass: transport.pass },
            ...LIMITES,
          }),
    };
  }
  const mailer = emCache.mailer;
  // Sem remetente próprio, sai do email do local da pessoa (as respostas vão para lá). Se o servidor de email não
  // deixar enviar com esse endereço, sai do remetente geral com a resposta para o local.
  const doLocal = input.de || input.semLocal ? null : await remetenteDoDestinatario(db, to).catch(() => null);
  const de = input.de ?? doLocal;
  const mensagem = {
    bcc: input.bcc ? sanitizeHeader(input.bcc) : undefined,
    // Nome e endereço separados: com texto «Nome <email>», vírgulas ou endereços no nome viravam destinatários.
    to: { name: sanitizeHeader(input.name), address: to },
    subject,
    text,
    html: input.html,
    attachments: input.anexos?.map(a => ({ filename: sanitizeHeader(a.nome), contentType: a.tipo, content: a.conteudo })),
  };
  const comRemetente = (r: { nome: string; email: string } | null | undefined) => ({
    from: r ? { name: sanitizeHeader(r.nome), address: sanitizeHeader(r.email) } : transport.from,
    replyTo: r ? sanitizeHeader(r.email) : transport.replyTo || undefined,
  });
  let info;
  try {
    info = await mailer.sendMail({ ...comRemetente(de), ...mensagem });
  } catch (err) {
    if (!doLocal) throw err;
    console.warn(`[mail] remetente ${doLocal.email} recusado; sai do remetente geral com resposta para o local`);
    info = await mailer.sendMail({ from: transport.from, replyTo: sanitizeHeader(doLocal.email), ...mensagem });
  }
  return info.messageId ?? "smtp";
}
