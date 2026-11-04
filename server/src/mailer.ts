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
  /**
   * Aviso da plataforma (não urgente). Para a equipa: aos administradores não sai; aos outros utilizadores (menos
   * formandos e formadores) só sai em horário laboral, senão fica guardado e sai no início do horário seguinte.
   */
  aviso?: boolean;
};

/** Horário laboral dos avisos à equipa: segunda a sábado, das 8:30 às 19:00, hora de Lisboa. */
export function emHorarioLaboral(agora = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(agora).map(x => [x.type, x.value]));
  if (p.weekday === "Sun") return false;
  const min = Number(p.hour) * 60 + Number(p.minute);
  return min >= 8 * 60 + 30 && min < 19 * 60;
}

/** Papel do utilizador activo com este email (null se não for utilizador). */
async function papelDoUtilizador(db: Db, email: string) {
  const r = await db.query<{ role: string }>("SELECT role FROM users WHERE active = true AND lower(email) = lower($1) LIMIT 1", [email]);
  return r.rows[0]?.role ?? null;
}

/**
 * Envia os avisos à equipa guardados fora de horas (no tick da API e no cron). Só em horário laboral; cada aviso tenta
 * até 5 vezes.
 */
export async function enviarAvisosAdiados(db: Db, agora = new Date(), limite = 30) {
  if (!emHorarioLaboral(agora)) return { enviados: 0 };
  const linhas = (await db.query<{ id: string; para: string; nome: string; assunto: string; texto: string; html: string | null; de: { nome: string; email: string } | null; anexos: { nome: string; tipo: string; b64: string }[] | null }>(
    `UPDATE emails_equipa_adiados SET tentativas = tentativas + 1
      WHERE id IN (SELECT id FROM emails_equipa_adiados WHERE enviado_em IS NULL AND tentativas < 5 ORDER BY id LIMIT $1 FOR UPDATE SKIP LOCKED)
      RETURNING id, para, nome, assunto, texto, html, de, anexos`, [limite])).rows;
  let enviados = 0;
  for (const l of linhas) {
    try {
      await sendMail(db, {
        to: l.para, name: l.nome, subject: l.assunto, text: l.texto, ...(l.html ? { html: l.html } : {}), ...(l.de ? { de: l.de } : {}),
        ...(l.anexos?.length ? { anexos: l.anexos.map(a => ({ nome: a.nome, tipo: a.tipo, conteudo: Buffer.from(a.b64, "base64") })) } : {}),
      });
      await db.query("UPDATE emails_equipa_adiados SET enviado_em = now(), erro = NULL WHERE id = $1", [l.id]);
      enviados += 1;
    } catch (err) {
      await db.query("UPDATE emails_equipa_adiados SET erro = $2 WHERE id = $1", [l.id, err instanceof Error ? err.message.slice(0, 400) : "falha no envio"]);
    }
  }
  return { enviados };
}

// Um transporte por configuração, reaproveitado entre envios (o cron manda vários seguidos). Com limites de tempo:
// um SMTP que não responde não pode prender a função da Vercel (30 s) até ela morrer a meio da fila.
const LIMITES = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000 };
let emCache: { chave: string; mailer: Transporter } | null = null;

export async function sendMail(db: Db, input: SendInput) {
  if (input.aviso) {
    const papel = await papelDoUtilizador(db, sanitizeHeader(input.to));
    // Os administradores não recebem avisos da plataforma.
    if (papel === "admin") return "sem-envio:administrador";
    // AVISOS_HORARIO=sempre (testes): sem horário.
    if (papel && papel !== "formando" && papel !== "formador" && process.env.AVISOS_HORARIO !== "sempre" && !emHorarioLaboral()) {
      const r = await db.query<{ id: string }>(
        `INSERT INTO emails_equipa_adiados (para, nome, assunto, texto, html, de, anexos) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb) RETURNING id`,
        [sanitizeHeader(input.to), input.name, input.subject, input.text, input.html ?? null, input.de ? JSON.stringify(input.de) : null,
          input.anexos?.length ? JSON.stringify(input.anexos.map(a => ({ nome: a.nome, tipo: a.tipo, b64: a.conteudo.toString("base64") }))) : null]);
      return `adiado:${r.rows[0]?.id ?? ""}`;
    }
  }
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
