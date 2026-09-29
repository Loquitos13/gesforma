import { randomBytes } from "node:crypto";
import { ingestEvent } from "./automations.js";
import { config } from "./config.js";
import { logLeadEvent } from "./crmDossier.js";
import type { Db } from "./db/pool.js";
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
  lead: { id: number; email: string; nome: string; apelido?: string; curso: string; turma?: string },
  type: "preinscricao.created" | "preinscricao.promoted",
  key: string,
) {
  const email = normalizeEmail(lead.email);
  if (!isEmail(email)) return { token: "", url: "", queued: 0 };
  const token = await ensureDocsToken(db, lead.id);
  const url = documentosUrl(token);
  const nome = `${lead.nome} ${lead.apelido ?? ""}`.trim();
  const r = await ingestEvent(db, type, {
    email,
    nome,
    curso: lead.curso,
    turma: lead.turma ?? "-",
    preinscricaoId: lead.id,
    documentos_url: url,
  }, key).catch(() => ({ queued: 0 }));
  return { token, url, queued: r.queued ?? 0 };
}

/** Gera o link, envia o email e regista o contacto automático. */
export async function notificarDocumentos(db: Db, id: number, actorId?: string) {
  const row = await db.query(
    "SELECT id, nome, apelido, email, curso FROM preinscricoes WHERE id = $1",
    [id],
  );
  const lead = row.rows[0] as { id: number; nome: string; apelido: string; email: string; curso: string } | undefined;
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
