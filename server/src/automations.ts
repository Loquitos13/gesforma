import { randomUUID } from "node:crypto";
import type { Db } from "./db/pool.js";
import { buildCtaVars, ctaDestino, fillCtaHref, hrefDoBotao } from "./emailCta.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { parseEmailXml } from "./emailXml.js";
import { lerEntidade } from "./regrasConfig.js";
import { linhaContactosLocal } from "../../src/partilhado/contactosLocal.js";
import { config } from "./config.js";
import { sendMail } from "./mailer.js";
import {
  avancarEstadoLead, devolverReservas, exemploReal, formandosDaTurma, leadsParados, libertarReservasPresas, marcarEnviado,
  marcarFalha, porNaFila, regraComModelo, regrasActivasPara, registarEvento, reservarPendentes, turmasQueComecam,
  type EnvioReservado, type RegraComModelo,
} from "./repos/emails.js";
import { CRM_ESTADO_RANK, crmEstadoFromEvent, EVENT_ALIASES, fillVars, isEmail, normalizeEmail, sanitizeHeader, sanitizeText } from "./security.js";
import { hojeLisboa, somarDias } from "./datas.js";

type Modelo = Pick<RegraComModelo, "template_tipo" | "assunto" | "body_lines" | "body_xml" | "cta" | "cta_href" | "cta_ambito">;

function asLines(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

const origem = () => config.appOrigin.replace(/\/$/, "");

function listaDoPayload(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  return typeof raw === "string" ? raw.split("\n").filter(Boolean) : [];
}

/** Telefones por zona (Configurações › Entidade), um por linha. */
/**
 * Contactos para os emails ({{telefones_itens}}): os de cada local (Edição de Cursos › Locais), lidos no momento,
 * por isso mudar o contacto de um local muda logo o modelo e os envios seguintes. Todos os locais activos com
 * contactos, o da pessoa primeiro. Sem nenhum, os «Telefones por zona» da entidade.
 */
export async function telefonesPorZona(db: Db, alvo: { regime?: string | null; local?: string | null; preinscricaoId?: number | null } = {}) {
  let { regime, local } = alvo;
  if (alvo.preinscricaoId && (!regime || !local)) {
    const r = await db.query<{ regime: string | null; local: string | null }>(
      "SELECT regime, local FROM preinscricoes WHERE id = $1", [alvo.preinscricaoId]);
    regime ||= r.rows[0]?.regime ?? null;
    local ||= r.rows[0]?.local ?? null;
  }
  const chave = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const r = await db.query<{ regime: string; payload: Record<string, unknown> }>(
    "SELECT regime, payload FROM catalog_items WHERE kind = 'locais' ORDER BY id");
  const linhas = new Map<string, { local: string; linha: string; regime: string }>();
  for (const { regime: reg, payload: l } of r.rows) {
    if (String(l.status ?? "Ativo") === "Inactivo" || String(l.status ?? "") === "Inativo") continue;
    const nome = String(l.nome ?? "").trim();
    const linha = nome ? linhaContactosLocal(nome, l) : "";
    if (!linha) continue;
    const k = chave(nome);
    // O mesmo local nos dois regimes: fica o do regime pedido.
    if (!linhas.has(k) || reg === regime) linhas.set(k, { local: nome, linha, regime: reg });
  }
  // Todos os locais (a pessoa pode ter escolhido o local errado), com o seu primeiro.
  const todas = [...linhas.values()];
  const primeiro = local ? todas.filter(l => chave(l.local) === chave(local)) : [];
  const escolhidas = [...primeiro, ...todas.filter(l => !primeiro.includes(l))];
  if (escolhidas.length) return escolhidas.map(l => l.linha);
  return (await lerEntidade(db)).telefonesZona.split("\n").filter(Boolean);
}

/** Monta assunto, texto e HTML de um modelo com as variáveis dadas (o mesmo que sai no envio real). */
export function renderModelo(m: Modelo, nome: string, vars: Record<string, string>, extra: { pixelUrl?: string; note?: string } = {}) {
  const subject = fillVars(m.assunto, vars);
  const fromXml = parseEmailXml(m.body_xml ?? "");
  const linhas = fromXml.linhas.length ? fromXml.linhas : asLines(m.body_lines);
  const cta = fromXml.cta || m.cta;
  const ambito = fromXml.ambito || m.cta_ambito || ctaDestino(m.template_tipo).ambito;
  const href = fillCtaHref(hrefDoBotao(m.template_tipo, ambito, fromXml.href || m.cta_href || ""), vars);
  const mail = renderAutomaticEmail({ nome, xml: m.body_xml ?? "", linhas, cta, href, vars, origin: config.appOrigin, ...extra });
  return { subject, ...mail };
}

export async function ingestEvent(db: Db, type: string, payload: Record<string, unknown>, idempotencyKey: string) {
  const email = normalizeEmail(String(payload.email ?? ""));
  if (!isEmail(email)) throw new Error("Email do destinatário inválido.");
  const id = await registarEvento(db, randomUUID(), type, idempotencyKey, payload);
  if (!id) return { eventId: null, queued: 0, duplicate: true };

  const nome = sanitizeHeader(String(payload.nome ?? "Formando"));
  const curso = sanitizeHeader(String(payload.curso ?? ""));
  const turma = sanitizeHeader(String(payload.turma ?? "-"));
  const regras = await regrasActivasPara(db, EVENT_ALIASES[type] ?? [type]);
  const vars = buildCtaVars({
    nome, email, curso, turma,
    documentosUrl: String(payload.documentos_url ?? ""),
    comprovativoUrl: String(payload.comprovativo_url ?? ""),
    referencia: String(payload.referencia ?? ""),
    entidade: String(payload.entidade ?? ""),
    valor: String(payload.valor ?? ""),
    documentosLista: String(payload.documentos_lista ?? ""),
    documentosItens: listaDoPayload(payload.documentos_itens),
    emFaltaItens: listaDoPayload(payload.documentos_em_falta_itens),
    cronogramasItens: listaDoPayload(payload.cronogramas_itens),
    telefonesItens: regras.length
      ? await telefonesPorZona(db, { regime: String(payload.regime ?? "") || null, local: String(payload.local ?? "") || null, preinscricaoId: Number(payload.preinscricaoId) || null })
      : [],
  });
  let queued = 0;
  for (const regra of regras) {
    if (regra.curso && curso && regra.curso.trim().toLowerCase() !== curso.trim().toLowerCase()) continue;
    const jobId = randomUUID();
    const mail = renderModelo(regra, nome, vars, { pixelUrl: `${origem()}/api/v1/email/open/${jobId}.gif` });
    const posto = await porNaFila(db, {
      id: jobId, regraId: regra.id, eventoId: id, para: email, nome, assunto: mail.subject,
      texto: sanitizeText(mail.text, 8000), html: mail.html.slice(0, 20000),
      quando: new Date(Date.now() + regra.delay_seconds * 1000).toISOString(), payload,
    });
    if (posto) queued += 1;
  }
  // Sem email (regra desligada ou já enviado) a etapa do lead não muda: senão o funil mostrava um contacto que não houve.
  if (!SO_COM_ENVIO.includes(type) || queued > 0) {
    await applyCrmEstado(db, type, payload).catch(() => undefined);
  }
  return { eventId: id, queued, duplicate: false };
}

const SO_COM_ENVIO = ["preinscricao.created", "preinscricao.unpaid_3d", "lead.stale_30d"];

/** Avança o lead no funil quando a automatização dispara. Nunca recua Pago/Formando. */
export async function applyCrmEstado(db: Db, type: string, payload: Record<string, unknown>) {
  const target = crmEstadoFromEvent(type);
  if (!target) return;
  const email = normalizeEmail(String(payload.email ?? ""));
  const pid = Number(payload.preinscricaoId ?? payload.preinscricao_id ?? 0);
  const idOk = Number.isInteger(pid) && pid > 0;
  if (!idOk && !isEmail(email)) return;
  await avancarEstadoLead(db, target, CRM_ESTADO_RANK[target] ?? 0, idOk ? pid : 0, email, {
    curso: String(payload.curso ?? "").trim(), pagamentoId: String(payload.pagamentoId ?? "").trim(),
  });
}

async function enqueueCrmReminders(db: Db, fim = 0) {
  const lembretes: [string, number, boolean, string][] = [
    ["preinscricao.unpaid_3d", 3, true, "unpaid3d"],
    ["lead.stale_30d", 30, false, "stale30d"],
  ];
  for (const [tipo, dias, soGold, prefixo] of lembretes) {
    for (const row of await leadsParados(db, dias, soGold, prefixo)) {
      if (fim && Date.now() >= fim) return;
      const email = normalizeEmail(row.email);
      if (!isEmail(email)) continue;
      await ingestEvent(db, tipo, { email, nome: `${row.nome} ${row.apelido}`.trim(), curso: row.curso, preinscricaoId: row.id }, `${prefixo}:${row.id}:${email}`)
        .catch(() => undefined);
    }
  }
}

async function enqueueTurmaReminders(db: Db) {
  const today = hojeLisboa();
  const tomorrow = somarDias(today, 1);
  for (const turma of await turmasQueComecam(db, [today, tomorrow])) {
    for (const a of await formandosDaTurma(db, turma.regime, turma.id, turma.nome)) {
      const email = normalizeEmail(a.email);
      if (!isEmail(email)) continue;
      await ingestEvent(
        db, "turma.starts_in_24h",
        { email, nome: `${a.nome} ${a.apelido}`.trim(), curso: a.curso || turma.curso, turma: turma.nome },
        `turma24h:${turma.id}:${email}:${turma.data_inicio ?? tomorrow}`,
      ).catch(() => undefined);
    }
  }
}

/** Minutos em «sending» a partir dos quais um envio se dá por interrompido (a função da Vercel dura no máximo 30 s). */
const RESERVA_PRESA_MIN = 10;

async function enviarReservado(db: Db, job: EnvioReservado) {
  try {
    const pixel = `${origem()}/api/v1/email/open/${job.id}.gif`;
    const html = job.body_html?.includes("<a ")
      ? job.body_html
      : job.body_text.split("\n").map(l => (l ? `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : "<br>")).join("")
        + `<img src="${pixel}" width="1" height="1" alt="" />`;
    await sendMail(db, { to: job.to_email, name: job.to_name, subject: job.subject, text: job.body_text, html });
    await marcarEnviado(db, job.id);
    return true;
  } catch (err) {
    await marcarFalha(db, job.id, job.attempts + 1 >= 5, err instanceof Error ? err.message.slice(0, 400) : "falha no envio");
    return false;
  }
}

/**
 * Envia a fila vencida. Cada envio é reservado antes de sair (ver `reservarPendentes`), por isso o cron,
 * o fim de um evento e uma pré-inscrição pública podem correr ao mesmo tempo sem duplicar emails.
 * Sem `orcamentoMs`, um lote de `limit`; com ele, lotes de `limit` até a fila esvaziar ou o tempo acabar
 * (o que ficou reservado e não saiu volta à fila).
 */
export async function flushQueuedJobs(db: Db, limit = 20, orcamentoMs = 0, eventoId: string | null = null) {
  const fim = orcamentoMs > 0 ? Date.now() + orcamentoMs : 0;
  let picked = 0;
  let sent = 0;
  let failed = 0;
  for (;;) {
    const lote = await reservarPendentes(db, limit, eventoId);
    picked += lote.length;
    for (let i = 0; i < lote.length; i++) {
      if (fim && Date.now() >= fim) {
        await devolverReservas(db, lote.slice(i).map(j => j.id));
        picked -= lote.length - i;
        return { picked, sent, failed };
      }
      if (await enviarReservado(db, lote[i]!)) sent += 1;
      else failed += 1;
    }
    if (!fim || lote.length < limit || Date.now() >= fim) break;
  }
  return { picked, sent, failed };
}

/**
 * Lembretes (turma a começar, leads parados) e depois a fila. `fim` (Date.now() + ms) é o prazo de tudo:
 * os lembretes param nele e a fila fica com o tempo que sobra (o cron da Vercel); sem ele, um lote de 20 como antes.
 */
export async function processDueJobs(db: Db, fim = 0) {
  await enqueueTurmaReminders(db).catch(() => undefined);
  await enqueueCrmReminders(db, fim).catch(() => undefined);
  const interrompidos = await libertarReservasPresas(db, RESERVA_PRESA_MIN).catch(() => []);
  const resta = fim - Date.now();
  const r = !fim ? await flushQueuedJobs(db, 20)
    : resta > 0 ? await flushQueuedJobs(db, 10, resta)
    : { picked: 0, sent: 0, failed: 0 };
  return { ...r, interrompidos: interrompidos.length };
}

/**
 * Variáveis de exemplo a partir dos dados reais (a pré-inscrição e a turma mais recentes do curso).
 * Sem dados na base, as variáveis ficam com o nome do campo entre parênteses.
 */
export async function varsDeExemplo(db: Db, curso: string | null, para: { email: string; nome: string }) {
  const { lead, turma } = await exemploReal(db, curso);
  const cursoEx = curso || lead?.curso || turma?.curso || "(curso)";
  const docs = lead?.docs_token ? `${origem()}/documentos/${lead.docs_token}` : `${origem()}/documentos/(ligação-pessoal)`;
  return buildCtaVars({
    nome: para.nome,
    email: para.email,
    curso: cursoEx,
    turma: turma?.nome ?? "(turma)",
    documentosUrl: docs,
    comprovativoUrl: `${docs}?passo=pagamento`,
    referencia: "",
    entidade: "",
    valor: "",
    documentosLista: "",
    documentosItens: ["(documento 1)", "(documento 2)"],
    emFaltaItens: ["(documento em falta)"],
    telefonesItens: await telefonesPorZona(db),
  });
}

/** Envia já o modelo da regra para um email de teste. Não avança o CRM nem respeita o atraso. */
export async function sendRuleTest(db: Db, ruleId: number, to: { email: string; name: string }) {
  const email = normalizeEmail(to.email);
  const nome = sanitizeHeader(to.name || "Teste");
  if (!isEmail(email)) throw new Error("Email de teste inválido");
  const regra = await regraComModelo(db, ruleId);
  if (!regra) throw new Error("Regra desconhecida");
  const vars = await varsDeExemplo(db, regra.curso, { email, nome });
  const jobId = randomUUID();
  const mail = renderModelo(regra, nome, vars, {
    pixelUrl: `${origem()}/api/v1/email/open/${jobId}.gif`,
    note: "Este envio é um teste da regra. Não altera o estado de nenhuma pré-inscrição.",
  });
  const subject = sanitizeHeader(`Teste · ${mail.subject}`);
  const body = sanitizeText(mail.text, 8000);
  const eventId = await registarEvento(db, randomUUID(), "email.test", `test:${ruleId}:${jobId}`, { email, nome, teste: true, ruleId });
  if (!eventId) throw new Error("O teste não foi registado.");
  await porNaFila(db, {
    id: jobId, regraId: regra.id, eventoId: eventId, para: email, nome, assunto: subject, texto: body,
    html: mail.html.slice(0, 20000), quando: new Date().toISOString(), payload: { teste: true, ruleId: regra.id },
    estado: "sending",
  });
  try {
    const mailId = await sendMail(db, { to: email, name: nome, subject, text: body, html: mail.html });
    const logged = String(mailId).startsWith("log:");
    await marcarEnviado(db, jobId, logged ? "SMTP desligado: ficou só no registo da API" : null);
    return { ok: true as const, to: email, logged, id: String(mailId) };
  } catch (err) {
    const message = err instanceof Error ? err.message.slice(0, 400) : "falha no envio";
    await marcarFalha(db, jobId, true, message);
    throw err instanceof Error ? err : new Error(message);
  }
}
