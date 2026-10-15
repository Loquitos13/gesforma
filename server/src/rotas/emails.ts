import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { ingestEvent, processDueJobs, renderModelo, sendRuleTest, varsDeExemplo } from "../automations.js";
import { config, onVercel } from "../config.js";
import { SECRETARIA_MAIL, ctaDestino } from "../emailCta.js";
import {
  actualizarModelo, actualizarRegra, apagarRegra, cancelarEmFila, criarRegra, destinatarioConhecido, estatisticasEnvios30Dias,
  existeModeloTipo, listarEnvios, listarModelos, listarRegras, marcarAberto, obterEnvio, obterModelo, reenviarFalhado,
} from "../repos/emails.js";
import { delayLabelFromSeconds, delaySecondsFromLabel, isEmail, TRIGGER_MAP } from "../security.js";
import { getSmtpStatus } from "../smtpConfig.js";
import { idParam, paginacao, periodoQuery, textoQuery, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

// Emails automáticos: regras, modelos, histórico de envios, eventos, pixel de abertura e cron.

/** O que cada gatilho faz (para o ecrã de regras). As chaves são as de TRIGGER_MAP. */
const DESCRICAO_GATILHO: Record<string, string> = {
  "Nova pré-inscrição recebida": "Envia a ligação pessoal para os documentos do curso.",
  "Pré-inscrição promovida": "Volta a enviar a ligação dos documentos.",
  "Lead passou a pré-inscrito": "Volta a enviar a ligação dos documentos.",
  "Documentos da pré-inscrição submetidos": "A pessoa concluiu o envio dos documentos.",
  "Pré-inscrição validada pela secretaria": "A secretaria validou a pré-inscrição.",
  "1.º contacto registado": "A secretaria registou o primeiro contacto.",
  "Pré-inscrição sem pagamento há 3 dias": "Lembrete a quem ainda não pagou (Gold).",
  "Pagamento confirmado": "O pagamento passou a Pago.",
  "Contacto após a venda": "Depois do pagamento: turma e próximos passos.",
  "24 horas antes do início": "A turma começa amanhã.",
  "Formando marcado como concluído": "Conclusão do curso e certificado.",
  "30 dias sem compra": "Reengajamento de leads parados.",
  "Sumário da sessão assinado": "Aviso interno ao formador.",
};
const ATRASOS = ["Imediatamente", "1 hora depois", "24 horas depois", "3 dias depois"];
const AMBITOS = [
  { valor: "documentos", rotulo: "Ligação pessoal (documentos)" },
  { valor: "pagamento", rotulo: "Passo de pagamento" },
  { valor: "preinscricao", rotulo: "Formulário de pré-inscrição" },
  { valor: "contacto", rotulo: "Contactar a secretaria" },
];
const VARIAVEIS = [
  "nome", "email", "curso", "turma", "documentos_url", "comprovativo_url", "preinscricao_url", "secretaria_url", "valor", "documentos_lista",
  "documentos_itens", "documentos_em_falta_itens", "telefones_itens", "cronogramas_itens", "faturacao_url",
];

const regraSchema = z.object({
  nome: z.string().trim().min(2).max(160),
  gatilho: z.string().min(2).max(160),
  templateTipo: z.string().min(2).max(64),
  atraso: z.string().max(40).optional(),
  curso: z.string().max(200).optional().nullable(),
  ativo: z.boolean().optional(),
});
const modeloSchema = z.object({
  nome: z.string().trim().min(2).max(120).optional(),
  assunto: z.string().trim().min(2).max(200).optional(),
  body_lines: z.array(z.string().trim().min(1).max(800)).min(1).max(20).optional(),
  body_xml: z.string().trim().min(8).max(8000).optional(),
  cta: z.string().trim().min(1).max(120).optional(),
  cta_href: z.string().trim().min(1).max(500).optional(),
  cta_ambito: z.enum(["preinscricao", "contacto", "documentos", "pagamento"]).optional(),
});
const previewSchema = modeloSchema.extend({
  tipo: z.string().min(2).max(64),
  curso: z.string().max(200).optional().nullable(),
});
const eventSchema = z.object({
  type: z.enum([
    "preinscricao.created", "preinscricao.promoted", "preinscricao.docs_completos", "preinscricao.validated",
    "preinscricao.contacted", "payment.confirmed", "sale.followup", "formando.completed", "sessao.summary_signed",
    "preinscricao.unpaid_3d", "turma.starts_in_24h", "lead.stale_30d",
  ]),
  payload: z.object({
    email: z.string(),
    nome: z.string().min(1).max(160),
    curso: z.string().max(200).optional(),
    turma: z.string().max(120).optional(),
    preinscricaoId: z.number().int().positive().optional(),
  }),
  idempotencyKey: z.string().min(8).max(200),
});
const enviosQuery = paginacao.merge(periodoQuery).extend({
  regra: z.preprocess(v => (v === "" ? undefined : v), z.coerce.number().int().positive().optional()),
  estado: z.preprocess(v => (v === "" ? undefined : v), z.enum(["queued", "sent", "failed", "cancelled"]).optional()),
  q: textoQuery(120),
});
const uuidParam = z.object({ id: z.string().uuid() });

function mapRegra(r: Awaited<ReturnType<typeof listarRegras>>[number]) {
  return {
    id: r.id,
    nome: r.nome,
    gatilho: r.gatilho_label,
    evento: r.trigger_key,
    template: r.template_tipo,
    templateNome: r.template_nome,
    atraso: delayLabelFromSeconds(r.delay_seconds),
    curso: r.curso,
    ativo: r.ativo,
    envios: r.envios,
    abertos: r.abertos,
    falhados: r.falhados,
    emFila: r.em_fila,
    taxaAbertura: r.envios > 0 ? Math.round((r.abertos / r.envios) * 100) : 0,
    ultimoEnvio: r.ultimo_envio,
  };
}

/** Remetente efectivo dos automáticos (SMTP configurado ou variáveis do servidor). */
async function remetente(db: Deps["db"]) {
  const s = await getSmtpStatus(db);
  if (s.configured && s.fromEmail) return `${s.fromName} <${s.fromEmail}>`;
  return config.mailFrom;
}

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;
  const actor = (req: FastifyRequest) => req.actor!;

  app.get("/v1/email/opcoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const modelos = await listarModelos(db);
    return {
      gatilhos: Object.keys(TRIGGER_MAP).map(valor => ({ valor, evento: TRIGGER_MAP[valor], descricao: DESCRICAO_GATILHO[valor] ?? "" })),
      atrasos: ATRASOS,
      modelos: modelos.map(m => ({ tipo: m.tipo, nome: m.nome })),
      ambitos: AMBITOS,
      variaveis: VARIAVEIS,
      remetente: await remetente(db),
      contacto: SECRETARIA_MAIL,
    };
  });

  app.get("/v1/email/templates", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const modelos = await listarModelos(db);
    return { templates: modelos.map(m => ({ ...m, funcao: ctaDestino(m.tipo).funcao })) };
  });

  app.patch("/v1/email/templates/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: modeloSchema }, req);
    if (!v) return;
    if (!(await obterModelo(db, v.params.id))) return reply.code(404).send({ error: "modelo inexistente" });
    await actualizarModelo(db, v.params.id, v.body);
    await audit(db, actor(req).id, "email.template_update", "email_template", String(v.params.id), req.ip);
    return { template: await obterModelo(db, v.params.id) };
  });

  /** Pré-visualização exacta do email (o mesmo HTML que sai), com dados reais da base. */
  app.post("/v1/email/previsualizar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: previewSchema }, req);
    if (!v) return;
    const modelos = await listarModelos(db);
    const base = modelos.find(m => m.tipo === v.body.tipo);
    if (!base) return reply.code(404).send({ error: "modelo inexistente" });
    const m = {
      template_tipo: base.tipo,
      assunto: v.body.assunto ?? base.assunto,
      body_lines: v.body.body_lines ?? base.body_lines,
      body_xml: v.body.body_xml ?? base.body_xml,
      cta: v.body.cta ?? base.cta,
      cta_href: v.body.cta_href ?? base.cta_href,
      cta_ambito: v.body.cta_ambito ?? base.cta_ambito,
    };
    const nome = actor(req).name;
    const vars = await varsDeExemplo(db, v.body.curso || null, { email: actor(req).email, nome });
    const mail = renderModelo(m, nome, vars);
    return { assunto: mail.subject, html: mail.html, texto: mail.text, para: actor(req).email, de: await remetente(db) };
  });

  for (const caminho of ["/v1/email/rules", "/v1/email/regras"]) {
    app.get(caminho, async (req, reply) => {
      if (!requireAuth(req, reply)) return;
      return { rules: (await listarRegras(db)).map(mapRegra) };
    });
  }

  app.post("/v1/email/rules", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: regraSchema }, req);
    if (!v) return;
    const key = TRIGGER_MAP[v.body.gatilho];
    if (!key) return reply.code(400).send({ error: "gatilho desconhecido" });
    if (!(await existeModeloTipo(db, v.body.templateTipo))) return reply.code(400).send({ error: "modelo desconhecido" });
    const id = await criarRegra(db, {
      nome: v.body.nome, triggerKey: key, gatilho: v.body.gatilho, templateTipo: v.body.templateTipo,
      atrasoSeg: delaySecondsFromLabel(v.body.atraso ?? "Imediatamente"), curso: v.body.curso || null, ativo: v.body.ativo ?? true,
    });
    await audit(db, actor(req).id, "email.rule_create", "email_rule", String(id), req.ip);
    return { id };
  });

  app.patch("/v1/email/rules/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: regraSchema.partial() }, req);
    if (!v) return;
    const d = v.body;
    const key = d.gatilho ? TRIGGER_MAP[d.gatilho] : undefined;
    if (d.gatilho && !key) return reply.code(400).send({ error: "gatilho desconhecido" });
    if (d.templateTipo && !(await existeModeloTipo(db, d.templateTipo))) return reply.code(400).send({ error: "modelo desconhecido" });
    await actualizarRegra(db, v.params.id, {
      nome: d.nome, gatilho: d.gatilho, triggerKey: key, templateTipo: d.templateTipo,
      atrasoSeg: d.atraso != null ? delaySecondsFromLabel(d.atraso) : undefined,
      curso: d.curso === undefined ? undefined : (d.curso || null), ativo: d.ativo,
    });
    await audit(db, actor(req).id, "email.rule_update", "email_rule", String(v.params.id), req.ip, { ...d });
    return { ok: true };
  });

  app.post("/v1/email/rules/:id/teste", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    try {
      const result = await sendRuleTest(db, v.params.id, { email: actor(req).email, name: actor(req).name });
      await audit(db, actor(req).id, "email.rule_test", "email_rule", String(v.params.id), req.ip);
      return result;
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "o teste não saiu" });
    }
  });

  app.delete("/v1/email/rules/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    await apagarRegra(db, v.params.id);
    await audit(db, actor(req).id, "email.rule_delete", "email_rule", String(v.params.id), req.ip);
    return { ok: true };
  });

  // ─── Histórico de envios ──────────────────────────────────────────────────

  app.get("/v1/email/jobs", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await processDueJobs(db).catch(() => undefined);
    const stats = await estatisticasEnvios30Dias(db);
    const pagina = await listarEnvios(db, { pagina: 1, porPagina: 80 });
    return {
      stats: stats ?? { sent: 0, queued: 0, failed: 0, abertos: 0 },
      jobs: pagina.linhas.map(j => ({
        id: j.id, to_email: j.para, to_name: j.nome, subject: j.assunto, status: j.estado,
        scheduled_at: j.agendado, sent_at: j.enviado, last_error: j.erro, regra: j.regra,
      })),
    };
  });

  app.get("/v1/email/envios", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: enviosQuery }, req);
    if (!v) return;
    const [stats, pagina] = [await estatisticasEnvios30Dias(db), await listarEnvios(db, v.query)];
    return { stats: stats ?? { sent: 0, queued: 0, failed: 0, abertos: 0 }, ...pagina };
  });

  app.get("/v1/email/envios/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: uuidParam }, req);
    if (!v) return;
    const e = await obterEnvio(db, v.params.id);
    if (!e) return reply.code(404).send({ error: "envio inexistente" });
    return { envio: { id: e.id, assunto: e.subject, html: e.body_html, texto: e.body_text, para: e.to_email } };
  });

  app.post("/v1/email/envios/:id/reenviar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: uuidParam }, req);
    if (!v) return;
    if (!(await reenviarFalhado(db, v.params.id))) return reply.code(409).send({ error: "Só se reenviam envios falhados." });
    await audit(db, actor(req).id, "email.job_retry", "email_job", v.params.id, req.ip);
    await processDueJobs(db).catch(() => undefined);
    return { ok: true };
  });

  app.post("/v1/email/envios/:id/cancelar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: uuidParam }, req);
    if (!v) return;
    if (!(await cancelarEmFila(db, v.params.id))) return reply.code(409).send({ error: "Só se cancelam envios em fila." });
    await audit(db, actor(req).id, "email.job_cancel", "email_job", v.params.id, req.ip);
    return { ok: true };
  });

  // ─── Pixel, cron e eventos ────────────────────────────────────────────────

  const PIXEL_GIF = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
  app.get("/v1/email/open/:id", async (req, reply) => {
    const raw = String((req.params as { id?: string }).id ?? "").replace(/\.gif$/i, "");
    if (/^[0-9a-f-]{36}$/i.test(raw)) await marcarAberto(db, raw).catch(() => undefined);
    return reply
      .header("Content-Type", "image/gif")
      .header("Cache-Control", "no-store, no-cache, must-revalidate, private")
      .header("Pragma", "no-cache")
      .send(PIXEL_GIF);
  });

  app.get("/v1/cron/email", async (req, reply) => {
    // Com CRON_SECRET definido (o Vercel envia-o como Bearer), só esse segredo abre o cron.
    // Sem ele, aceita-se o cabeçalho do Vercel apenas quando a API corre no Vercel.
    const bearer = Boolean(config.cronSecret) && req.headers.authorization === `Bearer ${config.cronSecret}`;
    const cron = !config.cronSecret && onVercel && req.headers["x-vercel-cron"] === "1";
    if (!cron && !bearer) return reply.code(401).send({ error: "cron recusado" });
    return processDueJobs(db);
  });

  app.post("/v1/events", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: eventSchema }, req);
    if (!v) return;
    const { type, payload, idempotencyKey } = v.body;
    if (!isEmail(payload.email)) return reply.code(400).send({ error: "email inválido" });
    const alvo = payload.email.trim().toLowerCase();
    const a = actor(req);
    if (a.role === "formador") {
      if (type !== "sessao.summary_signed" || alvo !== a.email.trim().toLowerCase()) {
        return reply.code(403).send({ error: "O formador só envia o aviso do próprio sumário." });
      }
    } else if (!(await destinatarioConhecido(db, alvo))) {
      return reply.code(403).send({ error: "Destinatário desconhecido no GesForma." });
    }
    try {
      const result = await ingestEvent(db, type, payload, idempotencyKey);
      await processDueJobs(db).catch(() => undefined);
      await audit(db, a.id, "automation.event", type, result.eventId ?? undefined, req.ip, { queued: result.queued, duplicate: result.duplicate });
      return result;
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "evento recusado" });
    }
  });
}
