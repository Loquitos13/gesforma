import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { docsDoCurso } from "./docsCurso.js";
import { documentosUrl, ensureDocsToken, listarDocsLead } from "./docsLink.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { sendMail } from "./mailer.js";
import { isEmail, normalizeEmail } from "./security.js";

export type UnidadeLembrete = "minutos" | "horas" | "dias";

const UNIDADES = new Set<UnidadeLembrete>(["minutos", "horas", "dias"]);

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
  return {
    activo: values.activo === "0" ? "0" : "1",
    quantidade: String(quantidade),
    unidade,
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
  const row = await db.query<{ values: unknown }>("SELECT values FROM app_settings WHERE id = 'lembrete_pre'");
  const raw = row.rows[0]?.values;
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
  });
  const cfg = normal ?? { activo: "1", quantidade: "1", unidade: "dias" };
  return {
    activo: cfg.activo !== "0",
    quantidade: Number(cfg.quantidade),
    unidade: cfg.unidade as UnidadeLembrete,
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
  const table = regime === "fin" ? "turmas_fin" : "turmas_gold";
  const row = await db.query<{ nome: string }>(`SELECT nome FROM ${table} WHERE id = $1`, [id]);
  return String(row.rows[0]?.nome ?? "");
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

export async function enviarLembretesPreinscricao(db: Db) {
  const cfg = await lerLembretePre(db);
  if (!cfg.activo) return { enviados: 0 };
  await db.query(
    "UPDATE preinscricoes SET lembrete_pre_em = now() WHERE validada_em IS NULL AND lembrete_pre_em IS NULL",
  );
  const limite = new Date(Date.now() - cfg.segundos * 1000);
  const devidos = await db.query<{
    id: number; nome: string; apelido: string; email: string; curso: string; regime: string;
    turma_escolhida_id: number | null; turmas_recusadas: unknown;
  }>(
    `SELECT id, nome, apelido, email, curso, COALESCE(regime, 'gold') AS regime,
            turma_escolhida_id, turmas_recusadas
       FROM preinscricoes
      WHERE validada_em IS NULL
        AND btrim(email) <> ''
        AND lembrete_pre_em IS NOT NULL
        AND lembrete_pre_em <= $1
      ORDER BY lembrete_pre_em
      LIMIT 20`,
    [limite],
  );
  let enviados = 0;
  for (const lead of devidos.rows) {
    const pendencia = await pendenciaDe(db, lead);
    if (!temPendencia(pendencia)) {
      await db.query("UPDATE preinscricoes SET lembrete_pre_em = now() WHERE id = $1", [lead.id]);
      continue;
    }
    const reclamado = await db.query<{ id: number }>(
      "UPDATE preinscricoes SET lembrete_pre_em = now() WHERE id = $1 AND lembrete_pre_em <= $2 RETURNING id",
      [lead.id, limite],
    );
    if (!reclamado.rows[0]) continue;
    const email = normalizeEmail(lead.email);
    if (!isEmail(email)) continue;
    const token = await ensureDocsToken(db, lead.id);
    const base = documentosUrl(token);
    const docs = pendencia.faltam.length > 0 || pendencia.recusados.length > 0;
    const href = `${base}?passo=${docs ? "documentos" : "cronograma"}`;
    const nome = `${lead.nome} ${lead.apelido}`.trim();
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
    enviados += 1;
  }
  return { enviados };
}
