import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Db } from "./db/pool.js";
import { sendMail } from "./mailer.js";
import {
  disconnectSmtp,
  getSmtpStatus,
  saveSmtpConfig,
  smtpCreds,
} from "./smtpConfig.js";
import { isEmail, normalizeEmail } from "./security.js";

const saveSchema = z.object({
  host: z.string().trim().max(200).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  login: z.string().trim().min(3).max(254),
  smtpKey: z.string().trim().min(8).max(400).optional(),
  fromName: z.string().trim().max(120).optional(),
  fromEmail: z.string().trim().min(3).max(254),
  replyTo: z.string().trim().min(3).max(254),
});

const testSchema = z.object({
  to: z.string().trim().max(254).optional(),
});

type Auth = {
  requireAuth: (req: FastifyRequest, reply: FastifyReply) => boolean;
  audit: (
    db: Db,
    actorId: string | undefined,
    action: string,
    entity: string,
    entityId?: string,
    ip?: string,
    meta?: Record<string, unknown>,
  ) => Promise<void>;
};

export function registerSmtpRoutes(app: FastifyInstance, db: Db, { requireAuth, audit }: Auth) {
  app.get("/v1/settings/smtp", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor!.role !== "admin") {
      return reply.code(403).send({ error: "só a administração configura o SMTP" });
    }
    return getSmtpStatus(db);
  });

  app.put("/v1/settings/smtp", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor!.role !== "admin") {
      return reply.code(403).send({ error: "só a administração configura o SMTP" });
    }
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    try {
      await saveSmtpConfig(db, parsed.data);
      await audit(db, req.actor!.id, "settings.smtp", "smtp_config", "brevo", req.ip);
      return getSmtpStatus(db);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "configuração recusada" });
    }
  });

  app.post("/v1/settings/smtp/desligar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor!.role !== "admin") {
      return reply.code(403).send({ error: "só a administração configura o SMTP" });
    }
    const prev = await smtpCreds(db);
    if (prev.fromEnv) return reply.code(400).send({ error: "SMTP definido no servidor (SMTP_URL)" });
    await disconnectSmtp(db);
    await audit(db, req.actor!.id, "settings.smtp_off", "smtp_config", "brevo", req.ip);
    return getSmtpStatus(db);
  });

  app.post("/v1/settings/smtp/teste", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor!.role !== "admin") {
      return reply.code(403).send({ error: "só a administração configura o SMTP" });
    }
    const parsed = testSchema.safeParse(req.body ?? {});
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const to = normalizeEmail(parsed.data.to || req.actor!.email);
    if (!isEmail(to)) return reply.code(400).send({ error: "email de teste inválido" });
    const status = await getSmtpStatus(db);
    if (!status.configured) {
      return reply.code(400).send({ error: "grave primeiro o SMTP da Brevo" });
    }
    try {
      const id = await sendMail(db, {
        to,
        name: req.actor!.name,
        subject: "GesForma · teste SMTP Brevo",
        text: [
          "Este é um envio de teste do GesForma.",
          "Se chegou à caixa, o serviço SMTP da Brevo está correcto.",
          "Responda a esta mensagem para confirmar o email de redireccionamento das respostas.",
        ].join("\n"),
      });
      await audit(db, req.actor!.id, "settings.smtp_test", "smtp_config", to, req.ip);
      return { ok: true, id };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "o teste não saiu" });
    }
  });
}
