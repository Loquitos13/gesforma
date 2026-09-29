import { randomBytes } from "node:crypto";
import { ingestEvent, flushQueuedJobs } from "./automations.js";
import { config } from "./config.js";
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
import { COMPROVATIVO, docsCompletos, docsDoCurso } from "./docsCurso.js";
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

export async function listarDocsLead(db: Db, leadId: number) {
  const docs = await db.query<{ id: number; tipo: string; nome: string; drive_file_id: string; drive_url: string; created_at: string }>(
    "SELECT id, tipo, nome, drive_file_id, drive_url, created_at FROM preinscricao_docs WHERE preinscricao_id = $1 ORDER BY created_at",
    [leadId],
  );
  return docs.rows;
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
