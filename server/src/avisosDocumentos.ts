/**
 * Notificações dos documentos em falta ou recusados.
 * · Recusa: quando a secretaria recusa um documento, a pessoa recebe logo o email «documento_recusado»
 *   (modelo editável) com os documentos recusados, o motivo e a ligação pessoal. Recusas seguidas agrupam-se:
 *   sai no máximo um email por janela (`JANELA_RECUSA_S`); as que ficarem seguem na volta seguinte
 *   (cron / worker) ou com «Reenviar pedido agora».
 * · Reenvio manual («Reenviar pedido agora»): recusados → «documento_recusado»; só em falta → «lembrete_docs».
 * · Formandos da Financiada: lembretes automáticos dos documentos do dossiê, na cadência das pré-inscrições,
 *   depois de um lembrete manual ou de uma recusa, até ficarem completos (ou a ligação fechar).
 */
import { renderModelo, telefonesPorZona } from "./automations.js";
import { config } from "./config.js";
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { documentosUrl, ensureDocsToken } from "./docsLink.js";
import { buildCtaVars } from "./emailCta.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { vistaDocumentosFormandoFin } from "./formandoFinDocs.js";
import { enviarLembretesPreinscricao, lerLembretePre } from "./lembretePre.js";
import { motivoFecho } from "./ligacaoPessoal.js";
import { sendMail } from "./mailer.js";
import { itemRecusa, pendenciaDocsLead } from "./pendenciaDocs.js";
import * as repo from "./repos/avisosDocumentos.js";
import { modeloEmail } from "./repos/emails.js";
import { notaDoSistemaFin } from "./repos/finPipeline.js";
import * as leads from "./repos/leads.js";
import { isEmail, normalizeEmail } from "./security.js";

/** Recusas feitas dentro desta janela (segundos) depois de um email de recusa ficam para o email seguinte. */
export const JANELA_RECUSA_S = 300;
/** Pré-inscrições/formandos por lote na volta automática. */
const LOTE = 25;
/** O cron deixa este tempo à fila de emails (os avisos param antes). */
const RESERVA_FILA_MS = 4000;

type Envio = {
  tipo: "documento_recusado" | "lembrete_docs";
  para: string; nome: string; curso: string; href: string;
  recusados: string[]; faltam: string[]; telefones: string[];
};

/** Envia o modelo editável; sem ele (apagado), um texto equivalente. */
async function enviarModelo(db: Db, e: Envio) {
  const modelo = await modeloEmail(db, e.tipo);
  const vars = buildCtaVars({
    nome: e.nome, email: e.para, curso: e.curso, turma: "-", documentosUrl: e.href,
    emFaltaItens: e.tipo === "lembrete_docs" ? [...e.faltam, ...e.recusados] : e.faltam,
    recusadosItens: e.recusados, telefonesItens: e.telefones,
  });
  if (modelo) {
    const mail = renderModelo({ ...modelo, template_tipo: modelo.tipo }, e.nome, vars);
    await sendMail(db, { to: e.para, name: e.nome, subject: mail.subject, text: mail.text, html: mail.html });
    return;
  }
  const linhas = e.tipo === "documento_recusado"
    ? [`A secretaria analisou os documentos de ${e.curso} e não pôde aceitar estes:`, ...e.recusados,
      "Volte a enviá-los pela ligação pessoal. A ligação fica activa até a documentação estar regularizada."]
    : [`Ainda faltam documentos para a inscrição em ${e.curso}:`, ...e.faltam, ...e.recusados, "Use o botão para os enviar."];
  const mail = renderAutomaticEmail({
    nome: e.nome, xml: "", linhas, cta: e.tipo === "documento_recusado" ? "Corrigir documentos" : "Enviar documentos",
    href: e.href, vars, origin: config.appOrigin,
  });
  await sendMail(db, {
    to: e.para, name: e.nome,
    subject: `${e.tipo === "documento_recusado" ? "Documentos a corrigir" : "Documentos em falta"} · ${e.curso}`,
    text: mail.text, html: mail.html,
  });
}

export type ResultadoAviso = { enviado: boolean; adiado?: boolean; erro?: string; url?: string; documentos?: string[] };

/* ── Pré-inscrições ──────────────────────────────────────────────────────── */

/**
 * Email da recusa: todos os documentos recusados (com o motivo) e os que ainda faltam, com a ligação pessoal.
 * Sem `forcar`, só sai se houver recusas por avisar e nenhum email de recusa na janela; com ele (pedido da
 * secretaria) sai sempre que haja recusados. Regista o contacto no histórico.
 */
export async function avisarRecusasLead(db: Db, leadId: number, opts: { forcar?: boolean; actorId?: string } = {}): Promise<ResultadoAviso | null> {
  const lead = await leads.lead(db, leadId);
  if (!lead) return null;
  const fecho = motivoFecho(lead);
  if (fecho && fecho !== "expirada") return { enviado: false, erro: "A pré-inscrição está encerrada: a ligação pessoal fechou." };
  const porAvisar = await repo.recusasPorAvisarLead(db, leadId);
  const p = await pendenciaDocsLead(db, { id: leadId, curso: lead.curso, regime: lead.regime });
  if (!p.recusados.length) {
    await repo.marcarRecusasAvisadasLead(db, leadId, porAvisar);
    return { enviado: false, erro: "Não há documentos recusados." };
  }
  if (!opts.forcar && !porAvisar.length) return { enviado: false, erro: "As recusas já foram avisadas." };
  const reserva = await repo.reclamarEmailRecusaLead(db, leadId, JANELA_RECUSA_S, Boolean(opts.forcar));
  if (!reserva) return { enviado: false, adiado: true };
  const email = normalizeEmail(String(lead.email ?? ""));
  if (!isEmail(email)) {
    await repo.marcarRecusasAvisadasLead(db, leadId, porAvisar);
    return { enviado: false, erro: "A ficha não tem email." };
  }
  const token = await ensureDocsToken(db, leadId);
  const href = `${documentosUrl(token)}?passo=documentos`;
  const nome = `${lead.nome ?? ""} ${lead.apelido ?? ""}`.trim();
  const curso = String(lead.curso ?? "");
  const recusados = p.recusados.map(itemRecusa);
  try {
    await enviarModelo(db, {
      tipo: "documento_recusado", para: email, nome, curso, href, recusados, faltam: p.faltam,
      telefones: await telefonesPorZona(db, { preinscricaoId: leadId }),
    });
  } catch (err) {
    await repo.libertarEmailRecusaLead(db, leadId, reserva.anterior);
    return { enviado: false, erro: err instanceof Error ? err.message.slice(0, 200) : "Falha no envio do email." };
  }
  await repo.marcarRecusasAvisadasLead(db, leadId, p.recusados.map(d => d.id));
  await repo.reiniciarLembretesLead(db, leadId);
  const nota = `${opts.forcar ? "Pedido reenviado" : "Pedido de reenvio automático"} · documentos recusados: ${recusados.join("; ")}`.slice(0, 1000);
  await leads.inserirContacto(db, { leadId, actorId: opts.actorId ?? null, nota, meio: "Email" });
  await logLeadEvent(db, leadId, opts.actorId, "contacto", opts.forcar ? "Pedido reenviado · documentos recusados" : "Documento recusado · pedido de reenvio", nota);
  return { enviado: true, url: href, documentos: p.recusados.map(d => d.label) };
}

/** «Reenviar pedido agora»: recusados → email da recusa; só em falta → lembrete. Não conta para o máximo de lembretes. */
export async function reenviarPedidoLead(db: Db, leadId: number, actorId?: string): Promise<ResultadoAviso | null> {
  const lead = await leads.lead(db, leadId);
  if (!lead) return null;
  const fecho = motivoFecho(lead);
  if (fecho && fecho !== "expirada") return { enviado: false, erro: "A pré-inscrição está encerrada: a ligação pessoal fechou." };
  const p = await pendenciaDocsLead(db, { id: leadId, curso: lead.curso, regime: lead.regime });
  if (p.recusados.length) return avisarRecusasLead(db, leadId, { forcar: true, actorId });
  if (!p.faltam.length) return { enviado: false, erro: "Não há documentos em falta nem recusados." };
  const email = normalizeEmail(String(lead.email ?? ""));
  if (!isEmail(email)) return { enviado: false, erro: "A ficha não tem email." };
  const token = await ensureDocsToken(db, leadId);
  const href = `${documentosUrl(token)}?passo=documentos`;
  const nome = `${lead.nome ?? ""} ${lead.apelido ?? ""}`.trim();
  await enviarModelo(db, {
    tipo: "lembrete_docs", para: email, nome, curso: String(lead.curso ?? ""), href, recusados: [], faltam: p.faltam,
    telefones: await telefonesPorZona(db, { preinscricaoId: leadId }),
  });
  await repo.adiarLembreteLead(db, leadId);
  const nota = `Pedido reenviado · documentação em falta: ${p.faltam.join(", ")}`.slice(0, 1000);
  await leads.inserirContacto(db, { leadId, actorId: actorId ?? null, nota, meio: "Email" });
  await logLeadEvent(db, leadId, actorId, "contacto", "Pedido reenviado · documentos em falta", nota);
  return { enviado: true, url: href, documentos: p.faltam };
}

/* ── Formandos da Financiada ─────────────────────────────────────────────── */

async function fichaFinAberta(db: Db, formandoId: number) {
  return !(await leads.ligacaoFinFechada(db, formandoId));
}

function recusadosFin(vista: NonNullable<Awaited<ReturnType<typeof vistaDocumentosFormandoFin>>>) {
  return vista.documentos.filter(d => d.estado === "recusado").map(d => ({ id: d.id, label: d.label, observacao: d.observacao.trim() }));
}

/** Email da recusa ao formando da Financiada (mesmo modelo, com a ligação de documentos do formando). */
export async function avisarRecusasFin(db: Db, formandoId: number, opts: { forcar?: boolean; actorId?: string } = {}): Promise<ResultadoAviso | null> {
  const vista = await vistaDocumentosFormandoFin(db, formandoId);
  if (!vista) return null;
  if (!(await fichaFinAberta(db, formandoId))) return { enviado: false, erro: "A ligação de documentos deste formando está fechada." };
  const porAvisar = await repo.recusasPorAvisarFin(db, formandoId);
  const recusados = recusadosFin(vista);
  if (!recusados.length) {
    await repo.marcarRecusasAvisadasFin(db, formandoId, porAvisar);
    return { enviado: false, erro: "Não há documentos recusados." };
  }
  if (!opts.forcar && !porAvisar.length) return { enviado: false, erro: "As recusas já foram avisadas." };
  const reserva = await repo.reclamarEmailRecusaFin(db, formandoId, JANELA_RECUSA_S, Boolean(opts.forcar));
  if (!reserva) return { enviado: false, adiado: true };
  if (!isEmail(vista.email)) {
    await repo.marcarRecusasAvisadasFin(db, formandoId, porAvisar);
    return { enviado: false, erro: "A ficha não tem email." };
  }
  const itens = recusados.map(itemRecusa);
  const faltam = vista.documentos.filter(d => d.required && d.estado === "em_falta").map(d => d.label);
  try {
    await enviarModelo(db, {
      tipo: "documento_recusado", para: vista.email, nome: vista.nome, curso: vista.curso, href: vista.url,
      recusados: itens, faltam, telefones: await telefonesPorZona(db, { regime: "fin" }),
    });
  } catch (err) {
    await repo.libertarEmailRecusaFin(db, formandoId, reserva.anterior);
    return { enviado: false, erro: err instanceof Error ? err.message.slice(0, 200) : "Falha no envio do email." };
  }
  await repo.marcarRecusasAvisadasFin(db, formandoId, recusados.map(d => d.id));
  await repo.iniciarCicloFin(db, formandoId, true);
  await notaDoSistemaFin(db, formandoId, opts.actorId ?? null, `Pedido de reenvio enviado · documentos recusados: ${itens.join("; ")}`.slice(0, 1000));
  return { enviado: true, url: vista.url, documentos: recusados.map(d => d.label) };
}

/** Lembrete manual enviado: o formando entra no ciclo dos lembretes automáticos. */
export async function iniciarLembretesFin(db: Db, formandoId: number) {
  await repo.iniciarCicloFin(db, formandoId);
}

/** Uma volta dos lembretes automáticos dos formandos da Financiada (`fim`: prazo, 0 = um lote). */
export async function enviarLembretesFormandosFin(db: Db, fim = 0) {
  const cfg = await lerLembretePre(db);
  if (!cfg.activo) return { enviados: 0 };
  const limite = new Date(Date.now() - cfg.segundos * 1000);
  let enviados = 0;
  const vistos = new Set<number>();
  for (;;) {
    const lote = (await repo.formandosFinDevidos(db, limite, cfg.maximo, LOTE)).map(r => Number(r.id)).filter(id => !vistos.has(id));
    if (!lote.length) break;
    for (const id of lote) {
      if (fim && Date.now() >= fim) return { enviados };
      vistos.add(id);
      const vista = await vistaDocumentosFormandoFin(db, id);
      if (!vista || vista.completo) {
        await repo.pararCicloFin(db, id);
        continue;
      }
      const faltam = vista.documentos.filter(d => d.required && d.estado === "em_falta").map(d => d.label);
      const recusados = recusadosFin(vista).map(d => `${d.label} (recusado: ${d.observacao || "volte a enviar o ficheiro"})`);
      if (!faltam.length && !recusados.length) {
        // Tudo enviado, à espera da validação da secretaria: nada a pedir agora.
        await repo.adiarCicloFin(db, id);
        continue;
      }
      if (!isEmail(vista.email)) {
        await repo.pararCicloFin(db, id);
        continue;
      }
      if (!(await repo.reclamarLembreteFin(db, id, limite))) continue;
      // Uma falha (SMTP) não pára os outros; o lembrete reservado conta como enviado.
      const saiu = await enviarModelo(db, {
        tipo: "lembrete_docs", para: vista.email, nome: vista.nome, curso: vista.curso, href: vista.url,
        recusados, faltam, telefones: await telefonesPorZona(db, { regime: "fin" }),
      }).then(() => true, () => false);
      if (!saiu) continue;
      await notaDoSistemaFin(db, id, null, `Lembrete automático · documentos em falta: ${[...faltam, ...recusados].join(", ")}`.slice(0, 1000));
      enviados += 1;
    }
    if (!fim) break;
  }
  return { enviados };
}

/** Recusas que ficaram por avisar (agrupadas pela janela ou falha no envio). */
export async function enviarRecusasPendentes(db: Db, fim = 0) {
  let enviados = 0;
  for (const [listar, avisar] of [
    [repo.leadsComRecusasPorAvisar, avisarRecusasLead],
    [repo.formandosFinComRecusasPorAvisar, avisarRecusasFin],
  ] as const) {
    const vistos: number[] = [];
    for (;;) {
      const lote = await listar(db, JANELA_RECUSA_S, LOTE, vistos);
      if (!lote.length) break;
      for (const id of lote) {
        if (fim && Date.now() >= fim) return { enviados };
        vistos.push(id);
        const r = await avisar(db, id).catch(() => null);
        if (r?.enviado) enviados += 1;
      }
      if (!fim) break;
    }
  }
  return { enviados };
}

/**
 * A volta dos avisos de documentos (cron diário na Vercel, worker local fora dela): recusas por avisar,
 * lembretes das pré-inscrições e lembretes dos formandos da Financiada. Com `fim`, em lotes até ao prazo
 * (deixando `RESERVA_FILA_MS` à fila de emails); sem ele, um lote de cada.
 */
export async function enviarAvisosDocumentos(db: Db, fim = 0) {
  const prazo = fim ? Math.max(1, fim - RESERVA_FILA_MS) : 0;
  const recusas = await enviarRecusasPendentes(db, prazo);
  const lembretesPreinscricao = await enviarLembretesPreinscricao(db, prazo);
  const lembretesFormandosFin = await enviarLembretesFormandosFin(db, prazo);
  return { recusas, lembretesPreinscricao, lembretesFormandosFin };
}
