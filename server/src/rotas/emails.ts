import type { FastifyInstance, FastifyRequest } from "fastify";
import { arrumarNaPastaDaTurma } from "../driveFicheiros.js";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { flushQueuedJobs, ingestEvent, processDueJobs, renderModelo, sendRuleTest, varsDeExemplo } from "../automations.js";
import { config } from "../config.js";
import { CTA_BY_TIPO, SECRETARIA_MAIL, ctaDestino } from "../emailCta.js";
import { VARIAVEIS_DOS_MODELOS } from "../emailModelo.js";
import {
  actualizarModelo, actualizarRegra, apagarModelo, apagarRegra, areaDaRegra, areaDoEnvio, areaDoModelo, cancelarEmFila, criarModelo, criarRegra,
  destinatarioConhecido, emailDaPreinscricao, estatisticasEnvios30Dias, existeModeloTipo, listarEnvios, listarModelos, listarRegras, marcarAberto,
  obterEnvio, obterModelo, reenviarFalhado, regrasDoModelo,
  anexosDasRegras, contarAnexosRegra, juntarAnexoRegra, tirarAnexoRegra,
} from "../repos/emails.js";
import { AREAS_EMAIL, areaDoRegime, areasDoPerfil, type AreaEmail } from "../../../src/partilhado/emailAreas.js";
import { GATILHOS_COM_PRAZO } from "../regrasAgendadas.js";
import { tipoAnexo } from "../whatsapp.js";
import { eAvisoEquipa, GRUPOS_EQUIPA, gruposPorOmissao, type GrupoEquipa } from "../../../src/partilhado/equipasAviso.js";
import { delayLabelFromSeconds, delaySecondsFromLabel, isEmail, TRIGGER_MAP } from "../security.js";
import { getSmtpStatus } from "../smtpConfig.js";
import { enviarAvisosDocumentos } from "../avisosDocumentos.js";
import { arrumarDocsDosFormandos, arrumarTurmasNoRegime, sincronizarPartilhasPendentes } from "../driveArvore.js";
import { linhaVisivel } from "../repos/crmVisivel.js";
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
  "Antes da data limite de matrícula": "Às pré-inscrições da turma ainda por concluir, X dias antes da data limite de matrícula do cronograma.",
  "Antes do prazo dos documentos": "A quem ainda tem documentos em falta, X dias antes da data limite de matrícula (ou do início da turma).",
  "Pagamento pedido sem comprovativo": "X dias depois de pedido o pagamento, se ainda não chegou o comprovativo.",
  "Antes do início da turma (integração)": "Aos formandos da turma, X dias antes do início: local, horário e área do formando.",
  "Formando inserido numa turma": "Quando a pessoa passa a estar numa turma (inscrição concluída, inserida pela equipa ou mudada de turma). Sai do email do local.",
  "Documentos recebidos (aviso à equipa)": "Vai para a equipa escolhida em «Enviar para» quando a pessoa entrega todos os documentos obrigatórios.",
  "Comprovativo de pagamento recebido (aviso à equipa)": "Vai para a equipa escolhida em «Enviar para» quando chega o comprovativo de pagamento.",
  "Formador atribuído a uma turma": "Vai para o formador quando é atribuído a uma turma (ficha da turma ou cronograma).",
};
/** Cursos de uma regra (sem repetidos); aceita ainda o «curso» único antigo. Vazio = todos. */
function cursosDaRegra(lista: readonly string[] | null | undefined, curso?: string | null) {
  const todos = [...(lista ?? []), ...(curso ? [curso] : [])].map(c => c.trim()).filter(Boolean);
  return [...new Map(todos.map(c => [c.toLowerCase(), c])).values()];
}

/** Equipas de um aviso interno (sem repetidos); vazio = as da área por omissão. */
function gruposValidos(lista: readonly GrupoEquipa[] | null | undefined, area: AreaEmail, trigger = "") {
  const unicos = [...new Set(lista ?? [])];
  return unicos.length ? unicos : gruposPorOmissao(trigger, area);
}

const ATRASOS = ["Imediatamente", "1 hora depois", "24 horas depois", "3 dias depois"];
const AMBITOS = [
  { valor: "documentos", rotulo: "Ligação pessoal (documentos)" },
  { valor: "pagamento", rotulo: "Passo de pagamento" },
  { valor: "preinscricao", rotulo: "Formulário de pré-inscrição" },
  { valor: "contacto", rotulo: "Contactar a secretaria" },
];
const VARIAVEIS = [
  "nome", "email", "curso", "turma", "documentos_url", "comprovativo_url", "preinscricao_url", "secretaria_url", "valor", "documentos_lista",
  "documentos_itens", "documentos_em_falta_itens", "documentos_recusados_itens", "telefones_itens", "local_contactos_itens", "cronogramas_itens", "faturacao_url",
];

const regraSchema = z.object({
  /** Área da regra (só a administração escolhe; as outras ficam na sua). */
  area: z.enum(AREAS_EMAIL).optional(),
  nome: z.string().trim().min(2).max(160),
  gatilho: z.string().min(2).max(160),
  templateTipo: z.string().min(2).max(64),
  atraso: z.string().max(40).optional(),
  curso: z.string().max(200).optional().nullable(),
  /** Um ou vários cursos (vazio = todos). */
  cursos: z.array(z.string().trim().min(1).max(200)).max(50).optional().nullable(),
  ativo: z.boolean().optional(),
  /** Regras com prazo: dias antes (ou depois) da data de referência; vazio = o valor por omissão do gatilho. */
  dias: z.number().int().min(0).max(365).nullable().optional(),
  /** Avisos internos: a que equipas vai (Gold, Financiada, Contabilidade). */
  destinatarios: z.array(z.enum(GRUPOS_EQUIPA)).max(3).nullable().optional(),
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
/** Modelo novo (escrito à mão por uma coordenação ou pela contabilidade). */
const novoModeloSchema = z.object({
  area: z.enum(AREAS_EMAIL).optional(),
  nome: z.string().trim().min(2).max(120),
  assunto: z.string().trim().min(2).max(200),
  body_xml: z.string().trim().min(8).max(8000),
});
/** Os modelos escritos à mão têm este prefixo no tipo; só esses se apagam (os outros saem do código). */
const PREFIXO_PERSONALIZADO = "personalizado_";
const previewSchema = modeloSchema.extend({
  tipo: z.string().min(2).max(64),
  area: z.enum(AREAS_EMAIL).optional(),
  curso: z.string().max(200).optional().nullable(),
  /** Um ou vários cursos (vazio = todos). */
  cursos: z.array(z.string().trim().min(1).max(200)).max(50).optional().nullable(),
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
  estado: z.preprocess(v => (v === "" ? undefined : v), z.enum(["queued", "sending", "sent", "failed", "cancelled"]).optional()),
  q: textoQuery(120),
});
const uuidParam = z.object({ id: z.string().uuid() });

/**
 * Eventos que a equipa pode disparar à mão em POST /v1/events, por perfil. Nunca os de pagamento
 * (payment.confirmed e sale.followup passam o lead a «Pago»): esses só saem do servidor, quando o pagamento
 * é confirmado. O formador só avisa do próprio sumário. Comercial e Financiada só sobre uma pré-inscrição
 * que vêem (ver o handler).
 */
const EVENTOS_LEAD = [
  "preinscricao.created", "preinscricao.promoted", "preinscricao.docs_completos", "preinscricao.validated",
  "preinscricao.contacted", "preinscricao.unpaid_3d", "lead.stale_30d",
];
const EVENTOS_EQUIPA: Record<string, string[]> = {
  admin: [...EVENTOS_LEAD, "formando.completed", "turma.starts_in_24h", "sessao.summary_signed"],
  secretaria: [...EVENTOS_LEAD, "formando.completed", "turma.starts_in_24h", "sessao.summary_signed"],
  comercial: [...EVENTOS_LEAD, "sessao.summary_signed"],
  financiada: [...EVENTOS_LEAD, "sessao.summary_signed"],
  formador: ["sessao.summary_signed"],
};

/** O cron só abre com `Authorization: Bearer <CRON_SECRET>` (é o que a Vercel envia quando a variável existe). */
function cronAutorizado(authorization: string | undefined) {
  const esperado = Buffer.from(`Bearer ${config.cronSecret}`);
  const dado = Buffer.from(String(authorization ?? ""));
  return esperado.length === dado.length && timingSafeEqual(esperado, dado);
}
/** Tempo de trabalho por chamada do cron (a função tem 30 s na vercel.json): Drive e, no email, prazo de tudo. */
const CRON_ORCAMENTO_MS = 20_000;
// 18 s + até 10 s de um envio SMTP já começado cabem nos 30 s da função.
const CRON_EMAIL_MS = 18_000;

function mapRegra(r: Awaited<ReturnType<typeof listarRegras>>[number]) {
  return {
    id: r.id,
    area: r.area,
    nome: r.nome,
    gatilho: r.gatilho_label,
    evento: r.trigger_key,
    template: r.template_tipo,
    templateNome: r.template_nome,
    atraso: delayLabelFromSeconds(r.delay_seconds),
    curso: r.curso,
    cursos: r.cursos?.length ? r.cursos : r.curso ? [r.curso] : [],
    ativo: r.ativo,
    dias: r.dias,
    destinatarios: r.destinatarios ?? null,
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

  /** Áreas de quem pede (a administração vê todas). */
  const areasDe = (req: FastifyRequest) => areasDoPerfil(actor(req).role);
  /** A área pedida se o perfil a pode usar; sem ela, a primeira do perfil. */
  const areaPedida = (req: FastifyRequest, pedida?: AreaEmail): AreaEmail | null => {
    const areas = areasDe(req);
    if (pedida) return areas.includes(pedida) ? pedida : null;
    return areas[0] ?? null;
  };
  const doPerfil = (req: FastifyRequest, area: AreaEmail | null | undefined) => Boolean(area && areasDe(req).includes(area));

  app.get("/v1/email/opcoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const modelos = await listarModelos(db, areasDe(req));
    return {
      areas: areasDe(req),
      gatilhos: Object.keys(TRIGGER_MAP).map(valor => ({ valor, evento: TRIGGER_MAP[valor], descricao: DESCRICAO_GATILHO[valor] ?? "" })),
      atrasos: ATRASOS,
      // Gatilhos com prazo: os dias por omissão e a que data se referem (o ecrã mostra o campo «dias»).
      prazos: GATILHOS_COM_PRAZO,
      modelos: modelos.map(m => ({ tipo: m.tipo, nome: m.nome, area: m.area })),
      ambitos: AMBITOS,
      variaveis: VARIAVEIS,
      // Modelos dos emails automáticos com variáveis próprias e botão para o endereço próprio do email.
      variaveisPorTipo: Object.fromEntries(Object.entries(VARIAVEIS_DOS_MODELOS).map(([t, v]) => [t, Object.keys(v).filter(k => k !== "link")])),
      botaoProprio: Object.fromEntries(Object.entries(CTA_BY_TIPO).filter(([, d]) => d.href === "{{link}}").map(([t, d]) => [t, d.funcao])),
      remetente: await remetente(db),
      contacto: SECRETARIA_MAIL,
    };
  });

  app.get("/v1/email/templates", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const modelos = await listarModelos(db, areasDe(req));
    return { templates: modelos.map(m => ({ ...m, funcao: ctaDestino(m.tipo).funcao, personalizado: m.tipo.startsWith(PREFIXO_PERSONALIZADO) })) };
  });

  app.post("/v1/email/templates", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: novoModeloSchema }, req);
    if (!v) return;
    const area = areaPedida(req, v.body.area);
    if (!area) return reply.code(403).send({ error: "Só cria emails na sua área." });
    const tipo = `${PREFIXO_PERSONALIZADO}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const id = await criarModelo(db, { tipo, area, nome: v.body.nome, assunto: v.body.assunto, body_xml: v.body.body_xml });
    await audit(db, actor(req).id, "email.template_create", "email_template", String(id), req.ip, { area });
    return { template: await obterModelo(db, Number(id)) };
  });

  app.delete("/v1/email/templates/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const m = await areaDoModelo(db, v.params.id);
    if (!m || !doPerfil(req, m.area)) return reply.code(404).send({ error: "modelo inexistente" });
    if (!m.tipo.startsWith(PREFIXO_PERSONALIZADO)) return reply.code(409).send({ error: "Os emails automáticos do GesForma não se apagam: desligue a regra." });
    if (await regrasDoModelo(db, m.tipo, m.area)) return reply.code(409).send({ error: "Este email está numa regra: apague a regra primeiro." });
    await apagarModelo(db, v.params.id);
    await audit(db, actor(req).id, "email.template_delete", "email_template", String(v.params.id), req.ip);
    return { ok: true };
  });

  app.patch("/v1/email/templates/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: modeloSchema }, req);
    if (!v) return;
    const m = await areaDoModelo(db, v.params.id);
    if (!m || !doPerfil(req, m.area)) return reply.code(404).send({ error: "modelo inexistente" });
    await actualizarModelo(db, v.params.id, v.body);
    await audit(db, actor(req).id, "email.template_update", "email_template", String(v.params.id), req.ip);
    return { template: await obterModelo(db, v.params.id) };
  });

  /** Pré-visualização exacta do email (o mesmo HTML que sai), com dados reais da base. */
  app.post("/v1/email/previsualizar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: previewSchema }, req);
    if (!v) return;
    const area = areaPedida(req, v.body.area);
    const modelos = area ? await listarModelos(db, [area]) : [];
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
    const vars = { ...await varsDeExemplo(db, v.body.curso || null, { email: actor(req).email, nome }), ...(VARIAVEIS_DOS_MODELOS[v.body.tipo] ?? {}) };
    const mail = renderModelo(m, nome, vars);
    return { assunto: mail.subject, html: mail.html, texto: mail.text, para: actor(req).email, de: await remetente(db) };
  });

  for (const caminho of ["/v1/email/rules", "/v1/email/regras"]) {
    app.get(caminho, async (req, reply) => {
      if (!requireAuth(req, reply)) return;
      const regras = await listarRegras(db, areasDe(req));
      const anexos = await anexosDasRegras(db, regras.map(r => r.id));
      return {
        rules: regras.map(r => ({
          ...mapRegra(r),
          anexos: anexos.filter(a => a.rule_id === r.id).map(a => ({ id: a.id, nome: a.nome, mime: a.mime, tamanho: a.tamanho })),
        })),
      };
    });
  }

  app.post("/v1/email/rules", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: regraSchema }, req);
    if (!v) return;
    const key = TRIGGER_MAP[v.body.gatilho];
    if (!key) return reply.code(400).send({ error: "gatilho desconhecido" });
    const area = areaPedida(req, v.body.area);
    if (!area) return reply.code(403).send({ error: "Só cria regras na sua área." });
    if (!(await existeModeloTipo(db, v.body.templateTipo, area))) return reply.code(400).send({ error: "modelo desconhecido" });
    const id = await criarRegra(db, {
      area, nome: v.body.nome, triggerKey: key, gatilho: v.body.gatilho, templateTipo: v.body.templateTipo,
      atrasoSeg: delaySecondsFromLabel(v.body.atraso ?? "Imediatamente"), curso: v.body.curso || null, ativo: v.body.ativo ?? true,
      dias: GATILHOS_COM_PRAZO[key] ? v.body.dias ?? null : null,
      cursos: cursosDaRegra(v.body.cursos, v.body.curso),
      destinatarios: eAvisoEquipa(key) ? gruposValidos(v.body.destinatarios, area, key) : null,
    });
    await audit(db, actor(req).id, "email.rule_create", "email_rule", String(id), req.ip);
    return { id };
  });

  app.patch("/v1/email/rules/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: regraSchema.partial() }, req);
    if (!v) return;
    const d = v.body;
    const area = await areaDaRegra(db, v.params.id);
    if (!doPerfil(req, area)) return reply.code(404).send({ error: "regra inexistente" });
    const key = d.gatilho ? TRIGGER_MAP[d.gatilho] : undefined;
    if (d.gatilho && !key) return reply.code(400).send({ error: "gatilho desconhecido" });
    if (d.templateTipo && !(await existeModeloTipo(db, d.templateTipo, area!))) return reply.code(400).send({ error: "modelo desconhecido" });
    await actualizarRegra(db, v.params.id, {
      nome: d.nome, gatilho: d.gatilho, triggerKey: key, templateTipo: d.templateTipo,
      atrasoSeg: d.atraso != null ? delaySecondsFromLabel(d.atraso) : undefined,
      curso: d.curso === undefined && d.cursos === undefined ? undefined : null, ativo: d.ativo, dias: d.dias,
      cursos: d.cursos === undefined && d.curso === undefined ? undefined : cursosDaRegra(d.cursos, d.curso),
      destinatarios: d.destinatarios === undefined ? undefined : gruposValidos(d.destinatarios, area!),
    });
    await audit(db, actor(req).id, "email.rule_update", "email_rule", String(v.params.id), req.ip, { ...d });
    return { ok: true };
  });

  // Documentos anexados à regra: seguem com cada email da regra (PDF, imagem, Word ou Excel; até 8 MB, 5 por regra).
  app.post("/v1/email/rules/:id/anexos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    if (!doPerfil(req, await areaDaRegra(db, v.params.id))) return reply.code(404).send({ error: "regra inexistente" });
    let bytes: Buffer | null = null;
    let nome = "anexo";
    try {
      for await (const part of req.parts()) {
        if (part.type === "file") { nome = part.filename || nome; bytes = await part.toBuffer(); }
      }
    } catch {
      return reply.code(400).send({ error: "upload inválido" });
    }
    if (!bytes?.length) return reply.code(400).send({ error: "Escolha o ficheiro." });
    if (bytes.length > 8 * 1024 * 1024) return reply.code(400).send({ error: "O ficheiro tem mais de 8 MB." });
    const tipo = tipoAnexo(bytes, nome);
    if (!tipo) return reply.code(400).send({ error: "Só PDF, imagens (JPG, PNG), Word (.docx) ou Excel (.xlsx)." });
    if ((await contarAnexosRegra(db, v.params.id)) >= 5) return reply.code(409).send({ error: "Esta regra já tem 5 anexos." });
    const id = await juntarAnexoRegra(db, v.params.id, { nome: nome.replace(/[\\/\r\n]/g, "_"), mime: tipo.mime, bytes });
    await audit(db, actor(req).id, "email.rule_anexo", "email_rule", String(v.params.id), req.ip, { nome });
    return { id };
  });

  app.delete("/v1/email/rules/:id/anexos/:anexoId", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id?: string }).id);
    const anexoId = Number((req.params as { anexoId?: string }).anexoId);
    if (!Number.isInteger(id) || !Number.isInteger(anexoId)) return reply.code(400).send({ error: "pedido inválido" });
    if (!doPerfil(req, await areaDaRegra(db, id))) return reply.code(404).send({ error: "regra inexistente" });
    if (!(await tirarAnexoRegra(db, id, anexoId))) return reply.code(404).send({ error: "anexo inexistente" });
    await audit(db, actor(req).id, "email.rule_anexo_apagado", "email_rule", String(id), req.ip, { anexoId });
    return { ok: true };
  });

  app.post("/v1/email/rules/:id/teste", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    if (!doPerfil(req, await areaDaRegra(db, v.params.id))) return reply.code(404).send({ error: "regra inexistente" });
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
    if (!doPerfil(req, await areaDaRegra(db, v.params.id))) return reply.code(404).send({ error: "regra inexistente" });
    await apagarRegra(db, v.params.id);
    await audit(db, actor(req).id, "email.rule_delete", "email_rule", String(v.params.id), req.ip);
    return { ok: true };
  });

  // ─── Histórico de envios ──────────────────────────────────────────────────

  app.get("/v1/email/jobs", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const areas = areasDe(req);
    const stats = await estatisticasEnvios30Dias(db, areas);
    const pagina = await listarEnvios(db, { pagina: 1, porPagina: 80, areas });
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
    const areas = areasDe(req);
    const [stats, pagina] = [await estatisticasEnvios30Dias(db, areas), await listarEnvios(db, { ...v.query, areas })];
    return { stats: stats ?? { sent: 0, queued: 0, failed: 0, abertos: 0 }, ...pagina };
  });

  app.get("/v1/email/envios/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: uuidParam }, req);
    if (!v) return;
    if (!doPerfil(req, await areaDoEnvio(db, v.params.id))) return reply.code(404).send({ error: "envio inexistente" });
    const e = await obterEnvio(db, v.params.id);
    if (!e) return reply.code(404).send({ error: "envio inexistente" });
    return { envio: { id: e.id, assunto: e.subject, html: e.body_html, texto: e.body_text, para: e.to_email } };
  });

  app.post("/v1/email/envios/:id/reenviar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: uuidParam }, req);
    if (!v) return;
    if (!doPerfil(req, await areaDoEnvio(db, v.params.id))) return reply.code(404).send({ error: "envio inexistente" });
    if (!(await reenviarFalhado(db, v.params.id))) return reply.code(409).send({ error: "Só se reenviam envios falhados." });
    await audit(db, actor(req).id, "email.job_retry", "email_job", v.params.id, req.ip);
    await flushQueuedJobs(db, 5).catch(() => undefined);
    return { ok: true };
  });

  app.post("/v1/email/envios/:id/cancelar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: uuidParam }, req);
    if (!v) return;
    if (!doPerfil(req, await areaDoEnvio(db, v.params.id))) return reply.code(404).send({ error: "envio inexistente" });
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
    // Só com CRON_SECRET (a Vercel envia-o como Bearer). O cabeçalho x-vercel-cron forja-se: não conta.
    // Sem a variável, recusa-se sempre: fora da Vercel a fila corre no processo da API (app.ts).
    if (!config.cronSecret) {
      req.log.error("cron /v1/cron/email recusado: CRON_SECRET não está definida (defina-a na Vercel para o cron correr).");
      return reply.code(503).send({ error: "cron desligado: falta CRON_SECRET" });
    }
    if (!cronAutorizado(req.headers.authorization)) return reply.code(401).send({ error: "cron recusado" });
    // Um só prazo para tudo (a função dura no máximo 30 s): os avisos dos documentos (recusas por avisar e
    // lembretes, em lotes) param uns segundos antes dele e a fila fica com o que sobra.
    const fim = Date.now() + CRON_EMAIL_MS;
    const avisos = await enviarAvisosDocumentos(db, fim).catch(err => {
      req.log.error(err);
      return null;
    });
    const fila = await processDueJobs(db, fim);
    return {
      ...fila,
      lembretesPreinscricao: avisos?.lembretesPreinscricao ?? null,
      lembretesFormandosFin: avisos?.lembretesFormandosFin ?? null,
      recusasAvisadas: avisos?.recusas ?? null,
    };
  });

  // Partilhas das pastas das turmas na Drive (as antigas davam aos formandos a pasta inteira): aos poucos.
  app.get("/v1/cron/drive", async (req, reply) => {
    if (!config.cronSecret) {
      req.log.error("cron /v1/cron/drive recusado: CRON_SECRET não está definida.");
      return reply.code(503).send({ error: "cron desligado: falta CRON_SECRET" });
    }
    if (!cronAutorizado(req.headers.authorization)) return reply.code(401).send({ error: "cron recusado" });
    // As pastas das turmas antigas passam para dentro de «02_TURMAS_ATIVAS / Gold» (ou «/ Financiada»).
    const turmasNoRegime = await arrumarTurmasNoRegime(db, 8_000).catch(() => 0);
    const r = await sincronizarPartilhasPendentes(db, CRON_ORCAMENTO_MS);
    // Recibos e reembolso que ainda estão dentro de um dossiê passam para a pasta da turma.
    const arrumados = await arrumarNaPastaDaTurma(db, 5_000).catch(() => 0);
    // Os documentos antigos de cada formando passam para a pasta dele (com os da pré-inscrição e o comprovativo).
    const docsDosFormandos = await arrumarDocsDosFormandos(db, 10_000).catch(() => 0);
    return { ...r, arrumados, turmasNoRegime, docsDosFormandos };
  });

  app.post("/v1/events", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: eventSchema }, req);
    if (!v) return;
    const { type, payload, idempotencyKey } = v.body;
    if (!isEmail(payload.email)) return reply.code(400).send({ error: "email inválido" });
    const alvo = payload.email.trim().toLowerCase();
    const a = actor(req);
    if (!(EVENTOS_EQUIPA[a.role] ?? []).includes(type)) {
      return reply.code(403).send({
        error: a.role === "formador" ? "O formador só envia o aviso do próprio sumário." : "Este evento não se dispara à mão.",
      });
    }
    const gestao = a.role === "admin" || a.role === "secretaria";
    if (type === "sessao.summary_signed" && !gestao) {
      // O aviso do sumário vai para quem o assinou.
      if (alvo !== a.email.trim().toLowerCase()) {
        return reply.code(403).send({ error: a.role === "formador" ? "O formador só envia o aviso do próprio sumário." : "O aviso do sumário só vai para o próprio." });
      }
    } else if (payload.preinscricaoId || !gestao) {
      // Sobre uma pré-inscrição: tem de ser visível para quem pede e o email tem de ser o dela
      // (senão o estado de um lead mudava e o email ia para outra pessoa). Comercial e Financiada só assim.
      const pid = payload.preinscricaoId;
      if (!pid) return reply.code(400).send({ error: "Indique a pré-inscrição." });
      const email = await linhaVisivel(db, "preinscricoes", pid, a) ? await emailDaPreinscricao(db, pid) : null;
      if (email === null) return reply.code(404).send({ error: "registo não encontrado" });
      if (email.trim().toLowerCase() !== alvo) return reply.code(403).send({ error: "O email não é o desta pré-inscrição." });
    } else if (!(await destinatarioConhecido(db, alvo))) {
      return reply.code(403).send({ error: "Destinatário desconhecido no GesForma." });
    }
    try {
      const regimeLead = payload.preinscricaoId
        ? (await db.query<{ regime: string | null }>("SELECT regime FROM preinscricoes WHERE id = $1", [payload.preinscricaoId])).rows[0]?.regime
        : null;
      const result = await ingestEvent(db, type, payload, idempotencyKey, { area: areaDoRegime(regimeLead) });
      await flushQueuedJobs(db, 5, 0, result.eventId).catch(() => undefined);
      await audit(db, a.id, "automation.event", type, result.eventId ?? undefined, req.ip, { queued: result.queued, duplicate: result.duplicate });
      return result;
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "evento recusado" });
    }
  });
}
