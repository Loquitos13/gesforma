import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { avisosConfiguracao, config } from "../config.js";
import { avaliacoesGoogle, desligarAvaliacoesGoogle, estadoAvaliacoesGoogle, gravarAvaliacoesGoogle } from "../avaliacoesGoogle.js";
import { getDriveStatus } from "../googleDrive.js";
import { lerLembretePre } from "../lembretePre.js";
import { sendMail } from "../mailer.js";
import { METODOS_ACEITES } from "../pagamentos.js";
import { getMicrosoftStatus } from "../microsoftAuth.js";
import { lerEntidade, lerRegras } from "../regrasConfig.js";
import { isEmail, normalizeEmail } from "../security.js";
import { disconnectSmtp, getSmtpStatus, saveSmtpConfig, smtpCreds } from "../smtpConfig.js";
import { validar } from "../validacao.js";
import { whatsappLigado } from "../whatsapp.js";
import type { Deps } from "./tipos.js";

// Configurações: SMTP (Brevo) e o resumo do estado de cada secção do ecrã.

const smtpSchema = z.object({
  host: z.string().trim().max(200).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  login: z.string().trim().min(3).max(254),
  smtpKey: z.string().trim().min(8).max(400).optional(),
  fromName: z.string().trim().max(120).optional(),
  fromEmail: z.string().trim().min(3).max(254),
  replyTo: z.string().trim().min(3).max(254),
});
const testeSchema = z.object({ to: z.string().trim().max(254).optional() });
const googleSchema = z.object({
  // Place ID da ficha da ENA no Google Maps (ex.: ChIJ…).
  placeId: z.string().trim().min(10).max(300).regex(/^[A-Za-z0-9_-]+$/, "Place ID inválido"),
  chave: z.string().trim().min(20).max(200).optional(),
});

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  function soAdmin(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return false;
    if (req.actor!.role !== "admin") {
      reply.code(403).send({ error: "só a administração configura o SMTP" });
      return false;
    }
    return true;
  }

  /** Estado de cada secção das Configurações (para a lista lateral). Os segredos nunca saem. */
  app.get("/v1/configuracoes/estado", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const admin = req.actor!.role === "admin";
    const [entidade, regras, lembrete, smtp, drive, microsoft, whatsapp, google] = await Promise.all([
      lerEntidade(db),
      lerRegras(db),
      lerLembretePre(db),
      getSmtpStatus(db).catch(() => null),
      getDriveStatus(db).catch(() => null),
      getMicrosoftStatus(db).catch(() => null),
      whatsappLigado(db).catch(() => false),
      estadoAvaliacoesGoogle(db).catch(() => null),
    ]);
    const faltaEntidade = (["nif", "morada", "email", "telefone", "iban", "titularConta"] as const).filter(k => !entidade[k]);
    return {
      entidade: { completa: faltaEntidade.length === 0, emFalta: faltaEntidade, iban: Boolean(entidade.iban) },
      regras,
      lembrete: { activo: lembrete.activo, quantidade: lembrete.quantidade, unidade: lembrete.unidade, maximo: lembrete.maximo },
      smtp: smtp ? { ligado: smtp.configured, fromEnv: smtp.fromEnv, remetente: smtp.fromEmail || null } : { ligado: false, fromEnv: false, remetente: null },
      drive: drive ? { configurado: drive.configured, ligado: drive.connected, email: drive.email, modo: drive.mode } : { configurado: false, ligado: false, email: null, modo: "local" },
      microsoft: { ligado: Boolean(microsoft?.configured) },
      whatsapp: { ligado: whatsapp },
      googleAvaliacoes: { ligado: Boolean(google?.configurado), erro: Boolean(google?.erro) },
      pagamentos: { gateway: "por escolher", metodos: [...METODOS_ACEITES] },
      moodle: { estado: "em pausa" },
      avisos: admin ? avisosConfiguracao().length : 0,
      remetentePadrao: config.mailFrom,
    };
  });

  app.get("/v1/settings/smtp", async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    return getSmtpStatus(db);
  });

  app.put("/v1/settings/smtp", async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    const v = validar(reply, { body: smtpSchema }, req);
    if (!v) return;
    try {
      await saveSmtpConfig(db, v.body);
      await audit(db, req.actor!.id, "settings.smtp", "smtp_config", "brevo", req.ip);
      return getSmtpStatus(db);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "configuração recusada" });
    }
  });

  app.post("/v1/settings/smtp/desligar", async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    if ((await smtpCreds(db)).fromEnv) return reply.code(400).send({ error: "SMTP definido no servidor (SMTP_URL)" });
    await disconnectSmtp(db);
    await audit(db, req.actor!.id, "settings.smtp_off", "smtp_config", "brevo", req.ip);
    return getSmtpStatus(db);
  });

  // ─── Avaliações Google (o site mostra-as no bloco Testemunhos) ───────────────
  app.get("/v1/settings/google-avaliacoes", async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    return estadoAvaliacoesGoogle(db);
  });

  app.put("/v1/settings/google-avaliacoes", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    const v = validar(reply, { body: googleSchema }, req);
    if (!v) return;
    try {
      await gravarAvaliacoesGoogle(db, v.body);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "A Google recusou a chave ou o Place ID." });
    }
    await audit(db, req.actor!.id, "settings.google_avaliacoes", "app_settings", "google_avaliacoes", req.ip);
    return estadoAvaliacoesGoogle(db);
  });

  app.post("/v1/settings/google-avaliacoes/atualizar", { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    try {
      await avaliacoesGoogle(db, true);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "Não foi possível falar com a Google." });
    }
    return estadoAvaliacoesGoogle(db);
  });

  app.post("/v1/settings/google-avaliacoes/desligar", async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    await desligarAvaliacoesGoogle(db);
    await audit(db, req.actor!.id, "settings.google_avaliacoes_off", "app_settings", "google_avaliacoes", req.ip);
    return estadoAvaliacoesGoogle(db);
  });

  /** Para o site: a classificação e as avaliações guardadas (nunca a chave). */
  app.get("/v1/public/avaliacoes-google", { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } }, async () => {
    const c = await avaliacoesGoogle(db).catch(() => null);
    return c ? { rating: c.rating, total: c.total, url: c.url, avaliacoes: c.avaliacoes } : { rating: null, total: 0, url: "", avaliacoes: [] };
  });

  app.post("/v1/settings/smtp/teste", { config: { rateLimit: { max: 6, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    const v = validar(reply, { body: testeSchema }, req);
    if (!v) return;
    const to = normalizeEmail(v.body.to || req.actor!.email);
    if (!isEmail(to)) return reply.code(400).send({ error: "email de teste inválido" });
    if (!(await getSmtpStatus(db)).configured) return reply.code(400).send({ error: "grave primeiro o SMTP da Brevo" });
    try {
      const id = await sendMail(db, {
        to,
        name: req.actor!.name,
        subject: "GesForma · teste SMTP",
        text: [
          "Este é um envio de teste do GesForma.",
          "Se chegou à caixa, o serviço SMTP está correcto.",
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
