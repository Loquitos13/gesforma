import { renderModelo, telefonesPorZona } from "./automations.js";
import { config } from "./config.js";
import { logLeadEvent } from "./crmDossier.js";
import { buildCtaVars } from "./emailCta.js";
import { modeloEmail } from "./repos/emails.js";
import * as leads from "./repos/leads.js";
import { motivoFecho } from "./ligacaoPessoal.js";
import type { Db } from "./db/pool.js";
import * as repo from "./repos/lembretesPre.js";
import { docsDoCurso } from "./docsCurso.js";
import { documentosUrl, ensureDocsToken, listarDocsLead } from "./docsLink.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { sendMail } from "./mailer.js";
import { isEmail, normalizeEmail } from "./security.js";

export type UnidadeLembrete = "minutos" | "horas" | "dias";

const UNIDADES = new Set<UnidadeLembrete>(["minutos", "horas", "dias"]);

/** Número máximo de lembretes por pré-inscrição, quando a definição não o indica. */
const MAXIMO_OMISSAO = 5;

/** Com este número de contactos (lembretes incluídos), segue o último lembrete e param os envios. */
export const CONTACTOS_ULTIMO_LEMBRETE = 3;

export function idsRecusados(raw: unknown): number[] {
  const lista = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.replace(/[{}]/g, "").split(",")
      : [];
  const ids = lista.map(v => Number(String(v).trim())).filter(n => Number.isInteger(n) && n > 0);
  return [...new Set(ids)];
}

export function normalizarLembrete(values: Record<string, string>): Record<string, string> | null {
  const unidade = values.unidade;
  if (!UNIDADES.has(unidade as UnidadeLembrete)) return null;
  const quantidade = Number(values.quantidade);
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 999) return null;
  const maximo = values.maximo == null || values.maximo === "" ? MAXIMO_OMISSAO : Number(values.maximo);
  if (!Number.isInteger(maximo) || maximo < 1 || maximo > 50) return null;
  return {
    activo: values.activo === "0" ? "0" : "1",
    quantidade: String(quantidade),
    unidade,
    maximo: String(maximo),
  };
}

export function segundosDoLembrete(quantidade: number, unidade: string) {
  if (!Number.isInteger(quantidade) || quantidade < 1) return null;
  if (unidade === "minutos") return quantidade * 60;
  if (unidade === "horas") return quantidade * 3600;
  if (unidade === "dias") return quantidade * 86400;
  return null;
}

export async function lerLembretePre(db: Db) {
  const raw = await repo.configLembrete(db);
  const values: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string") values[k] = v;
    }
  }
  const normal = normalizarLembrete({
    activo: values.activo ?? "1",
    quantidade: values.quantidade ?? "1",
    unidade: values.unidade ?? "dias",
    maximo: values.maximo ?? "",
  });
  const cfg = normal ?? { activo: "1", quantidade: "1", unidade: "dias", maximo: String(MAXIMO_OMISSAO) };
  return {
    activo: cfg.activo !== "0",
    quantidade: Number(cfg.quantidade),
    unidade: cfg.unidade as UnidadeLembrete,
    maximo: Number(cfg.maximo) || MAXIMO_OMISSAO,
    segundos: segundosDoLembrete(Number(cfg.quantidade), cfg.unidade) ?? 86400,
  };
}

type Pendencia = {
  faltam: string[];
  recusados: { label: string; observacao: string }[];
  semTurma: boolean;
  turmaCheia: boolean;
  turmaCheiaNome: string;
};

async function nomeTurma(db: Db, regime: "gold" | "fin", id: number) {
  if (!id) return "";
  return repo.nomeDaTurma(db, regime, id);
}

async function pendenciaDe(db: Db, lead: {
  id: number; curso: string; regime: string; turma_escolhida_id: number | null; turmas_recusadas: unknown;
}): Promise<Pendencia> {
  const regime = lead.regime === "fin" ? "fin" : "gold";
  const pedidos = await docsDoCurso(db, lead.curso, regime);
  const ficheiros = await listarDocsLead(db, lead.id);
  const by = new Map(ficheiros.map(f => [f.tipo, f]));
  const faltam: string[] = [];
  const recusados: { label: string; observacao: string }[] = [];
  for (const doc of pedidos) {
    if (!doc.required) continue;
    const ficheiro = by.get(doc.id);
    if (!ficheiro) faltam.push(doc.label);
    else if (ficheiro.estado === "recusado") {
      recusados.push({ label: doc.label, observacao: ficheiro.observacao.trim() });
    }
  }
  // Financiada: a turma é atribuída pela secretaria, a pessoa só envia documentos.
  if (regime === "fin") return { faltam, recusados, semTurma: false, turmaCheia: false, turmaCheiaNome: "" };
  const recusadas = idsRecusados(lead.turmas_recusadas);
  const escolhida = Number(lead.turma_escolhida_id || 0);
  const turmaCheia = recusadas.length > 0 && !escolhida;
  const ultima = recusadas[recusadas.length - 1] ?? 0;
  return {
    faltam,
    recusados,
    semTurma: !escolhida && !turmaCheia,
    turmaCheia,
    turmaCheiaNome: turmaCheia ? await nomeTurma(db, regime, ultima) : "",
  };
}

function temPendencia(p: Pendencia) {
  return p.faltam.length > 0 || p.recusados.length > 0 || p.semTurma || p.turmaCheia;
}

/** `fim` (Date.now() + ms): o cron pára de enviar nesse instante; o que ficou sai na volta seguinte. */
export async function enviarLembretesPreinscricao(db: Db, fim = 0) {
  const cfg = await lerLembretePre(db);
  if (!cfg.activo) return { enviados: 0 };
  await repo.iniciarContagem(db);
  const limite = new Date(Date.now() - cfg.segundos * 1000);
  // Só pedidos abertos, com ligação pessoal enviada, e até ao máximo de lembretes.
  const devidos = await repo.devidos(db, limite, cfg.maximo);
  let enviados = 0;
  for (const lead of devidos) {
    if (fim && Date.now() >= fim) break;
    if (motivoFecho(lead)) {
      await repo.adiar(db, lead.id);
      continue;
    }
    const pendencia = await pendenciaDe(db, lead);
    if (!temPendencia(pendencia)) {
      await repo.adiar(db, lead.id);
      continue;
    }
    if (!(await repo.reclamarEnvio(db, lead.id, limite))) continue;
    const email = normalizeEmail(lead.email);
    if (!isEmail(email)) continue;
    const token = await ensureDocsToken(db, lead.id);
    const base = documentosUrl(token);
    const docs = pendencia.faltam.length > 0 || pendencia.recusados.length > 0;
    const href = `${base}?passo=${docs ? "documentos" : "cronograma"}`;
    const nome = `${lead.nome} ${lead.apelido}`.trim();
    if (docs) {
      // Documentos em falta: modelos editáveis (lembrete e, a partir de 3 contactos, o último lembrete).
      const final = (await repo.contarContactos(db, lead.id)) >= CONTACTOS_ULTIMO_LEMBRETE;
      const modelo = await modeloEmail(db, final ? "lembrete_docs_final" : "lembrete_docs");
      if (modelo) {
        const emFalta = [
          ...pendencia.faltam,
          ...pendencia.recusados.map(d => `${d.label} (recusado: ${d.observacao || "volte a enviar o ficheiro"})`),
        ];
        const vars = buildCtaVars({
          nome, email, curso: lead.curso, turma: "-", documentosUrl: href,
          emFaltaItens: emFalta, telefonesItens: await telefonesPorZona(db),
        });
        const mail = renderModelo({ ...modelo, template_tipo: modelo.tipo }, nome, vars);
        await sendMail(db, { to: email, name: nome, subject: mail.subject, text: mail.text, html: mail.html });
        const nota = `${final ? "Último lembrete" : "Lembrete"} automático · documentação pendente: ${emFalta.join(", ")}`.slice(0, 1000);
        await leads.inserirContacto(db, { leadId: lead.id, nota, meio: "Email" });
        await logLeadEvent(db, lead.id, undefined, "contacto", final ? "Último lembrete · documentos" : "Lembrete · documentos", nota);
        if (final) await repo.marcarUltimoLembrete(db, lead.id);
        enviados += 1;
        continue;
      }
    }
    const linhas = [`Lembrete da pré-inscrição em ${lead.curso}.`];
    if (pendencia.faltam.length) {
      linhas.push("Ainda faltam estes documentos:");
      linhas.push(...pendencia.faltam);
    }
    if (pendencia.recusados.length) {
      linhas.push("A secretaria recusou estes documentos:");
      linhas.push(...pendencia.recusados.map(d => `${d.label}: ${d.observacao || "não está correcto. Volte a enviar o ficheiro."}`));
    }
    if (pendencia.turmaCheia) {
      linhas.push(pendencia.turmaCheiaNome
        ? `A turma ${pendencia.turmaCheiaNome} foi dada como cheia pela secretaria. Escolha outra turma.`
        : "A turma escolhida foi dada como cheia pela secretaria. Escolha outra turma.");
    }
    if (pendencia.semTurma) linhas.push("Ainda falta escolher a turma.");
    linhas.push("Use o botão para abrir a ligação pessoal no passo que falta concluir.");
    const mail = renderAutomaticEmail({
      nome,
      xml: "",
      linhas,
      cta: docs ? "Enviar documentos" : "Escolher turma",
      href,
      vars: { nome, curso: lead.curso, documentos_url: href },
      origin: config.appOrigin,
    });
    await sendMail(db, {
      to: email,
      name: nome,
      subject: `Lembrete da pré-inscrição · ${lead.curso}`,
      text: mail.text,
      html: mail.html,
    });
    const nota = `Lembrete automático · ${docs ? "documentação pendente" : "falta escolher a turma"}`;
    await leads.inserirContacto(db, { leadId: lead.id, nota, meio: "Email" });
    await logLeadEvent(db, lead.id, undefined, "contacto", "Lembrete automático", nota);
    enviados += 1;
  }
  return { enviados };
}
