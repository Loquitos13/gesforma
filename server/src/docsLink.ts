import { garantirToken } from "./ligacaoPessoal.js";
import { transferirDocsDoLead } from "./docsParaFormando.js";
import { randomBytes } from "node:crypto";
import { ingestEvent, flushQueuedJobs } from "./automations.js";
import { config } from "./config.js";
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { COMPROVATIVO, docsCompletos, docsDoCurso } from "./docsCurso.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { sendMail } from "./mailer.js";
import { isEmail, normalizeEmail } from "./security.js";
import * as docs from "./repos/leadDocs.js";
import * as leads from "./repos/leads.js";

export function documentosUrl(token: string) {
  return `${config.appOrigin.replace(/\/$/, "")}/documentos/${token}`;
}

export async function ensureDocsToken(db: Db, id: number) {
  return garantirToken(db, id);
}

export async function firePreinscricaoEmail(
  db: Db,
  lead: { id: number; email: string; nome: string; apelido?: string; curso: string; turma?: string; regime?: string },
  type: "preinscricao.created" | "preinscricao.promoted",
  key: string,
) {
  const email = normalizeEmail(lead.email);
  if (!isEmail(email)) return { token: "", url: "", queued: 0 };
  const token = await ensureDocsToken(db, lead.id);
  const url = documentosUrl(token);
  const nome = `${lead.nome} ${lead.apelido ?? ""}`.trim();
  const regime = lead.regime === "fin" ? "fin" : "gold";
  const pedidos = await docsDoCurso(db, lead.curso, regime);
  const lista = pedidos.filter(d => d.required).map(d => d.label).join(", ");
  const r = await ingestEvent(db, type, {
    email,
    nome,
    curso: lead.curso,
    turma: lead.turma ?? "-",
    preinscricaoId: lead.id,
    documentos_url: url,
    documentos_lista: lista || "os documentos do curso",
    documentos_itens: pedidos.filter(d => d.required).map(d => d.label),
  }, key).catch(() => ({ queued: 0 }));
  await flushQueuedJobs(db, 8).catch(() => undefined);
  return { token, url, queued: r.queued ?? 0 };
}

/** Gera o link, envia o email e regista o contacto automático. */
export async function notificarDocumentos(db: Db, id: number, actorId?: string) {
  const row = await leads.lead(db, id);
  const lead = row as { id: number; nome: string; apelido: string; email: string; curso: string; regime?: string } | null;
  if (!lead) return null;
  const mail = await firePreinscricaoEmail(db, lead, "preinscricao.promoted", `promoted:${id}:${normalizeEmail(lead.email)}`);
  const nota = `Ligação pessoal para submeter ficheiros: ${mail.url}`;
  await leads.inserirContacto(db, { leadId: id, actorId, nota, meio: "Email" });
  await logLeadEvent(db, id, actorId, "contacto", "Contacto automático · documentos", nota);
  return mail;
}

/** Passa o lead a Pré-inscrição, gera o link pessoal e dispara o email + rasto de contacto. */
export async function promoverPreinscricao(
  db: Db,
  id: number,
  actorId?: string,
) {
  const lead = (await leads.lead(db, id)) as { id: number; estado: string } | null;
  if (!lead) return null;
  if (lead.estado === "Formando") return { skipped: true as const, estado: lead.estado };

  await leads.promoverAPreinscricao(db, id);
  if (lead.estado !== "Pré-inscrição") {
    await logLeadEvent(db, id, actorId, "estado", "Passou a Pré-inscrição", `De ${lead.estado}`);
  }
  const mail = await notificarDocumentos(db, id, actorId);
  return { skipped: false as const, ...mail };
}

export type DocLead = {
  id: number;
  tipo: string;
  nome: string;
  drive_file_id: string;
  drive_url: string;
  created_at: string;
  estado: string;
  observacao: string;
};

export async function listarDocsLead(db: Db, leadId: number) {
  return docs.docsDoLead(db, leadId) as Promise<DocLead[]>;
}

export async function abrirAlerta(db: Db, preinscricaoId: number) {
  const aberto = await docs.alertaAberto(db, preinscricaoId);
  if (aberto) return aberto;
  const id = randomBytes(12).toString("base64url");
  await docs.criarAlerta(db, id, preinscricaoId);
  return id;
}

export async function dispensarAlertas(db: Db, preinscricaoId: number) {
  await docs.dispensarAlertasDoLead(db, preinscricaoId);
}

export async function dispensarAlerta(db: Db, alertaId: string) {
  await docs.dispensarAlerta(db, alertaId);
}

/** Indica se os documentos obrigatórios estão validados. Não fecha a ligação: isso só acontece na validação da secretaria. */
export async function syncLigacao(db: Db, leadId: number) {
  const row = await leads.lead(db, leadId) as { curso: string; regime: string } | null;
  if (!row) return false;
  const regime = row.regime === "fin" ? "fin" : "gold";
  const pedidos = await docsDoCurso(db, row.curso, regime);
  const required = pedidos.filter(d => d.required);
  const ficheiros = await listarDocsLead(db, leadId);
  const byTipo = new Map(ficheiros.map(f => [f.tipo, f]));
  return required.length > 0 && required.every(d => byTipo.get(d.id)?.estado === "validado");
}

export async function definirEstadoDoc(
  db: Db,
  leadId: number,
  docId: number,
  estado: "validado" | "recusado",
  observacao = "",
  actorId?: string,
) {
  const upd = await docs.definirEstado(db, leadId, docId, estado, estado === "recusado" ? observacao.trim() : "", actorId ?? null);
  if (!upd) return null;
  if (estado === "validado") {
    await dispensarAlertas(db, leadId);
    // Só chega ao formando se a pré-inscrição estiver validada e a pessoa for formando de uma turma do curso.
    await transferirDocsDoLead(db, leadId, actorId);
  }
  if (estado === "recusado") {
    await docs.reabrirPercurso(db, leadId);
  }
  await syncLigacao(db, leadId);
  return upd.id;
}

/** Avisa a pessoa dos documentos que ainda não estão na ficha, com a ligação pessoal no passo dos documentos. */
export async function avisarDocumentosEmFalta(
  db: Db,
  leadId: number,
  emFalta: { label: string; recusado?: boolean; observacao?: string }[],
) {
  const faltam = emFalta.filter(d => !d.recusado);
  const recusados = emFalta.filter(d => d.recusado);
  if (!faltam.length && !recusados.length) return { enviado: false as const };
  const lead = await leads.lead(db, leadId) as { nome: string; apelido: string; email: string; curso: string } | null;
  if (!lead) return null;
  const email = normalizeEmail(lead.email);
  if (!isEmail(email)) return { enviado: false as const, erro: "A ficha não tem email." };
  const token = await ensureDocsToken(db, leadId);
  const url = `${documentosUrl(token)}?passo=documentos`;
  const nome = `${lead.nome} ${lead.apelido}`.trim();
  const linhas = [`A pré-inscrição em ${lead.curso} ficou registada e aguarda validação da secretaria.`];
  if (faltam.length) {
    linhas.push("Ainda faltam estes documentos:");
    linhas.push(...faltam.map(d => d.label));
  }
  if (recusados.length) {
    linhas.push("A secretaria recusou estes documentos:");
    linhas.push(...recusados.map(d => `${d.label}: ${d.observacao?.trim() || "não está correcto. Volte a enviar o ficheiro."}`));
  }
  linhas.push("Use o botão para abrir a ligação pessoal no passo de enviar os documentos. A ligação fecha quando a secretaria validar todos.");
  const mail = renderAutomaticEmail({
    nome,
    xml: "",
    linhas,
    cta: "Enviar documentos",
    href: url,
    vars: { nome, curso: lead.curso, documentos_url: url },
    origin: config.appOrigin,
  });
  await sendMail(db, {
    to: email,
    name: nome,
    subject: `Documentos em falta · ${lead.curso}`,
    text: mail.text,
    html: mail.html,
  });
  await docs.marcarLembreteDocs(db, leadId);
  await logLeadEvent(db, leadId, undefined, "contacto", "Documentos em falta", [...faltam, ...recusados].map(d => d.label).join(", "));
  return { enviado: true as const, url };
}

export async function alertarDocumentosIncorrectos(db: Db, leadId: number) {
  const lead = await leads.lead(db, leadId) as { nome: string; apelido: string; email: string; curso: string; regime: string } | null;
  if (!lead) return null;
  const email = normalizeEmail(lead.email);
  if (!isEmail(email)) return { enviado: false as const, erro: "A ficha não tem email." };
  const regime = lead.regime === "fin" ? "fin" : "gold";
  const pedidos = await docsDoCurso(db, lead.curso, regime);
  const labels = new Map(pedidos.map(p => [p.id, p.label]));
  labels.set("comprovativo", "Comprovativo de pagamento");
  const ficheiros = await listarDocsLead(db, leadId);
  const recusados = ficheiros.filter(f => f.estado === "recusado");
  if (!recusados.length) return { enviado: false as const, erro: "Não há documentos recusados." };
  const token = await ensureDocsToken(db, leadId);
  const url = documentosUrl(token);
  const nome = `${lead.nome} ${lead.apelido}`.trim();
  const linhas = [
    `Revimos os documentos de ${lead.curso}.`,
    ...recusados.map(d => `${labels.get(d.tipo) ?? d.tipo}: ${d.observacao.trim() || "não está correcto. Volte a enviar o ficheiro."}`),
    "Use o botão para enviar apenas estes documentos.",
  ];
  const mail = renderAutomaticEmail({
    nome,
    xml: "",
    linhas,
    cta: "Corrigir documentos",
    href: url,
    vars: { nome, curso: lead.curso, documentos_url: url },
    origin: config.appOrigin,
  });
  await sendMail(db, {
    to: email,
    name: nome,
    subject: `Documentos a corrigir · ${lead.curso}`,
    text: mail.text,
    html: mail.html,
  });
  await logLeadEvent(db, leadId, undefined, "contacto", "Documentos incorrectos", linhas.slice(1, -1).join(" · "));
  return { enviado: true as const, url };
}

export async function listarAlertasAbertas(db: Db) {
  return docs.alertasAbertos(db, 20);
}

export { COMPROVATIVO, docsCompletos, docsDoCurso };
