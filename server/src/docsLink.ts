import { randomBytes } from "node:crypto";
import { ingestEvent, flushQueuedJobs } from "./automations.js";
import { config } from "./config.js";
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { COMPROVATIVO, docsCompletos, docsDoCurso } from "./docsCurso.js";
import { renderAutomaticEmail } from "./emailHtml.js";
import { sendMail } from "./mailer.js";
import { firePagamentoRefEmail } from "./pagamentoPedido.js";
import { isEmail, normalizeEmail } from "./security.js";

export function documentosUrl(token: string) {
  return `${config.appOrigin.replace(/\/$/, "")}/documentos/${token}`;
}

export async function ensureDocsToken(db: Db, id: number) {
  const row = await db.query<{ docs_token: string | null }>(
    "SELECT docs_token FROM preinscricoes WHERE id = $1",
    [id],
  );
  const current = row.rows[0]?.docs_token;
  if (current) return current;
  const token = randomBytes(18).toString("base64url");
  await db.query(
    "UPDATE preinscricoes SET docs_token = $2 WHERE id = $1 AND docs_token IS NULL",
    [id, token],
  );
  const again = await db.query<{ docs_token: string | null }>(
    "SELECT docs_token FROM preinscricoes WHERE id = $1",
    [id],
  );
  return again.rows[0]?.docs_token ?? token;
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
  }, key).catch(() => ({ queued: 0 }));
  await flushQueuedJobs(db, 8).catch(() => undefined);
  return { token, url, queued: r.queued ?? 0 };
}

/** Gera o link, envia o email e regista o contacto automático. */
export async function notificarDocumentos(db: Db, id: number, actorId?: string) {
  const row = await db.query(
    "SELECT id, nome, apelido, email, curso, regime FROM preinscricoes WHERE id = $1",
    [id],
  );
  const lead = row.rows[0] as { id: number; nome: string; apelido: string; email: string; curso: string; regime?: string } | undefined;
  if (!lead) return null;
  const mail = await firePreinscricaoEmail(db, lead, "preinscricao.promoted", `promoted:${id}:${normalizeEmail(lead.email)}`);
  const nota = `Ligação pessoal para submeter ficheiros: ${mail.url}`;
  await db.query(
    "INSERT INTO preinscricao_contactos (preinscricao_id, actor_id, nota, meio) VALUES ($1,$2,$3,$4)",
    [id, actorId ?? null, nota, "Email"],
  );
  await logLeadEvent(db, id, actorId, "contacto", "Contacto automático · documentos", nota);
  return mail;
}

/** Passa o lead a Pré-inscrição, gera o link pessoal e dispara o email + rasto de contacto. */
export async function promoverPreinscricao(
  db: Db,
  id: number,
  actorId?: string,
) {
  const row = await db.query(
    "SELECT id, estado FROM preinscricoes WHERE id = $1",
    [id],
  );
  const lead = row.rows[0] as { id: number; estado: string } | undefined;
  if (!lead) return null;
  if (lead.estado === "Formando") return { skipped: true as const, estado: lead.estado };

  await db.query(
    `UPDATE preinscricoes SET
       estado = 'Pré-inscrição',
       contactado_em = COALESCE(contactado_em, now()),
       ultima_actividade_em = now()
     WHERE id = $1 AND estado <> 'Formando'`,
    [id],
  );
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
  const docs = await db.query<DocLead>(
    `SELECT id, tipo, nome, drive_file_id, drive_url, created_at,
            COALESCE(estado, 'pendente') AS estado,
            COALESCE(observacao, '') AS observacao
       FROM preinscricao_docs WHERE preinscricao_id = $1 ORDER BY created_at`,
    [leadId],
  );
  return docs.rows;
}

export async function abrirAlerta(db: Db, preinscricaoId: number) {
  const open = await db.query<{ id: string }>(
    "SELECT id FROM doc_alertas WHERE preinscricao_id = $1 AND dispensada_em IS NULL LIMIT 1",
    [preinscricaoId],
  );
  if (open.rows[0]) return open.rows[0].id;
  const id = randomBytes(12).toString("base64url");
  await db.query("INSERT INTO doc_alertas (id, preinscricao_id) VALUES ($1, $2)", [id, preinscricaoId]);
  return id;
}

export async function dispensarAlertas(db: Db, preinscricaoId: number) {
  await db.query(
    "UPDATE doc_alertas SET dispensada_em = now() WHERE preinscricao_id = $1 AND dispensada_em IS NULL",
    [preinscricaoId],
  );
}

export async function dispensarAlerta(db: Db, alertaId: string) {
  await db.query(
    "UPDATE doc_alertas SET dispensada_em = now() WHERE id = $1 AND dispensada_em IS NULL",
    [alertaId],
  );
}

/** Indica se os documentos obrigatórios estão validados. Não fecha a ligação: isso só acontece na validação da secretaria. */
export async function syncLigacao(db: Db, leadId: number) {
  const lead = await db.query<{ curso: string; regime: string }>(
    "SELECT curso, COALESCE(regime, 'gold') AS regime FROM preinscricoes WHERE id = $1",
    [leadId],
  );
  const row = lead.rows[0];
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
) {
  const upd = await db.query<{ id: number }>(
    `UPDATE preinscricao_docs
        SET estado = $3, observacao = $4
      WHERE id = $1 AND preinscricao_id = $2
      RETURNING id`,
    [docId, leadId, estado, estado === "recusado" ? observacao.trim() : ""],
  );
  if (!upd.rows[0]) return null;
  if (estado === "validado") await dispensarAlertas(db, leadId);
  if (estado === "recusado") {
    await db.query(
      "UPDATE preinscricoes SET percurso_concluido_em = NULL WHERE id = $1 AND validada_em IS NULL",
      [leadId],
    );
  }
  await syncLigacao(db, leadId);
  return upd.rows[0].id;
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
  const row = await db.query<{ nome: string; apelido: string; email: string; curso: string }>(
    "SELECT nome, apelido, email, curso FROM preinscricoes WHERE id = $1",
    [leadId],
  );
  const lead = row.rows[0];
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
  await db.query("UPDATE preinscricoes SET lembrete_pre_em = now() WHERE id = $1", [leadId]);
  await logLeadEvent(db, leadId, undefined, "contacto", "Documentos em falta", [...faltam, ...recusados].map(d => d.label).join(", "));
  return { enviado: true as const, url };
}

export async function alertarDocumentosIncorrectos(db: Db, leadId: number) {
  const row = await db.query<{ nome: string; apelido: string; email: string; curso: string; regime: string }>(
    "SELECT nome, apelido, email, curso, COALESCE(regime, 'gold') AS regime FROM preinscricoes WHERE id = $1",
    [leadId],
  );
  const lead = row.rows[0];
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
  const rows = await db.query<{
    id: string; preinscricao_id: number; created_at: string;
    nome: string; apelido: string; curso: string; regime: string;
  }>(
    `SELECT a.id, a.preinscricao_id, a.created_at, p.nome, p.apelido, p.curso, COALESCE(p.regime, 'gold') AS regime
       FROM doc_alertas a
       JOIN preinscricoes p ON p.id = a.preinscricao_id
      WHERE a.dispensada_em IS NULL
      ORDER BY a.created_at DESC
      LIMIT 20`,
  );
  return rows.rows;
}

export async function maybeEnviarPagamentoAposDocs(db: Db, leadId: number) {
  const lead = await db.query<{ curso: string; regime: string }>(
    "SELECT curso, COALESCE(regime, 'gold') AS regime FROM preinscricoes WHERE id = $1",
    [leadId],
  );
  const row = lead.rows[0];
  if (!row) return null;
  const regime = row.regime === "fin" ? "fin" : "gold";
  const pedidos = await docsDoCurso(db, row.curso, regime);
  const ficheiros = await listarDocsLead(db, leadId);
  const { ok } = docsCompletos(pedidos, ficheiros.map(f => f.tipo));
  if (!ok) return { enviou: false as const };
  return { enviou: true as const, ...(await firePagamentoRefEmail(db, leadId)) };
}

export async function popularFichaPessoa(
  db: Db,
  lead: { id: number; email: string; nome: string; apelido: string; curso: string; regime?: string },
  doc: { tipo: string; nome: string; driveFileId: string; driveUrl: string },
) {
  const email = normalizeEmail(lead.email);
  const data = new Date().toISOString().slice(0, 10);
  const regimes: ("gold" | "fin")[] = lead.regime === "fin" ? ["fin", "gold"] : ["gold", "fin"];
  for (const regime of regimes) {
    const table = regime === "fin" ? "formandos_fin" : "formandos_gold";
    const found = await db.query<{ id: number }>(
      `SELECT id FROM ${table} WHERE email <> '' AND lower(email) = $1 ORDER BY id DESC LIMIT 1`,
      [email],
    );
    const fid = found.rows[0]?.id;
    if (!fid) continue;
    await db.query(
      `INSERT INTO formando_docs (regime, formando_id, doc_id, ok, file_name, data, drive_file_id, drive_url)
       VALUES ($1, $2, $3, true, $4, $5, $6, $7)
       ON CONFLICT (regime, formando_id, doc_id) DO UPDATE SET
         ok = true, file_name = EXCLUDED.file_name, data = EXCLUDED.data,
         drive_file_id = EXCLUDED.drive_file_id, drive_url = EXCLUDED.drive_url, updated_at = now()`,
      [regime, fid, doc.tipo, doc.nome, data, doc.driveFileId, doc.driveUrl],
    );
  }
}

export { COMPROVATIVO, docsCompletos, docsDoCurso };
