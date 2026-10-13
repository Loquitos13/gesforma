import { randomBytes } from "node:crypto";
import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { DOCS_FORMANDO_FIN } from "../../src/partilhado/dossierDocs.js";
import { storeDriveFile } from "./googleDrive.js";
import { isEmail, normalizeEmail } from "./security.js";

export function formandoFinDocsUrl(token: string) {
  return `${config.appOrigin.replace(/\/$/, "")}/documentos-formando/${token}`;
}

export async function ensureFinDocsToken(db: Db, formandoId: number) {
  const row = await db.query<{ docs_token: string }>(
    "SELECT COALESCE(docs_token, '') AS docs_token FROM formandos_fin WHERE id = $1",
    [formandoId],
  );
  const current = row.rows[0]?.docs_token?.trim();
  if (current) return current;
  const token = randomBytes(18).toString("base64url");
  await db.query(
    "UPDATE formandos_fin SET docs_token = $2 WHERE id = $1 AND COALESCE(docs_token, '') = ''",
    [formandoId, token],
  );
  const again = await db.query<{ docs_token: string }>(
    "SELECT COALESCE(docs_token, '') AS docs_token FROM formandos_fin WHERE id = $1",
    [formandoId],
  );
  return again.rows[0]?.docs_token || token;
}

type DocRow = {
  doc_id: string;
  ok: boolean;
  file_name: string;
  data: string;
  drive_url: string;
  estado: string;
  observacao: string;
  validated_at: string | Date | null;
  validator_name: string;
};

async function rowsFor(db: Db, formandoId: number) {
  return db.query<DocRow>(
    `SELECT d.doc_id, d.ok, d.file_name, d.data, COALESCE(d.drive_url, '') AS drive_url,
            COALESCE(d.estado, 'pendente') AS estado, COALESCE(d.observacao, '') AS observacao,
            d.validated_at, COALESCE(u.name, '') AS validator_name
       FROM formando_docs d
       LEFT JOIN users u ON u.id = d.validated_by
      WHERE d.regime = 'fin' AND d.formando_id = $1`,
    [formandoId],
  );
}

export async function vistaDocumentosFormandoFin(db: Db, formandoId: number) {
  const f = await db.query<{ id: number; nome: string; apelido: string; email: string; curso: string; docs: unknown }>(
    "SELECT id, nome, apelido, email, curso, docs FROM formandos_fin WHERE id = $1",
    [formandoId],
  );
  const pessoa = f.rows[0];
  if (!pessoa) return null;
  const token = await ensureFinDocsToken(db, formandoId);
  const stored = await rowsFor(db, formandoId);
  const byId = new Map(stored.rows.map(r => [r.doc_id, r]));
  const docsJson = pessoa.docs && typeof pessoa.docs === "object" ? pessoa.docs as Record<string, unknown> : {};
  const documentos = DOCS_FORMANDO_FIN.map(def => {
    const row = byId.get(def.id);
    const leg = docsJson[def.id] && typeof docsJson[def.id] === "object"
      ? docsJson[def.id] as { ok?: boolean; data?: string }
      : null;
    const ok = row?.estado === "validado" || Boolean(row?.ok) || Boolean(leg?.ok);
    const estado = row?.estado === "recusado"
      ? "recusado" as const
      : ok
        ? "validado" as const
        : row?.file_name
          ? "pendente" as const
          : "em_falta" as const;
    return {
      id: def.id,
      label: def.label,
      required: Boolean(def.required),
      estado,
      observacao: row?.observacao ?? "",
      fileName: row?.file_name ?? "",
      driveUrl: row?.drive_url ?? "",
      validadoEm: row?.validated_at
        ? String(row.validated_at instanceof Date ? row.validated_at.toISOString() : row.validated_at).slice(0, 10)
        : leg?.data ?? "",
      validadoPor: row?.validator_name ?? "",
    };
  });
  const recusados = documentos.filter(d => d.estado === "recusado").map(d => d.id);
  return {
    formandoId: pessoa.id,
    nome: `${pessoa.nome} ${pessoa.apelido}`.trim(),
    curso: pessoa.curso,
    email: normalizeEmail(pessoa.email),
    token,
    url: formandoFinDocsUrl(token),
    documentos,
    recusados,
    completo: documentos.every(d => !d.required || d.estado === "validado"),
  };
}

export async function formandoFinPorToken(db: Db, token: string) {
  const row = await db.query<{ id: number }>(
    "SELECT id FROM formandos_fin WHERE docs_token = $1",
    [token],
  );
  const id = row.rows[0]?.id;
  if (!id) return null;
  return vistaDocumentosFormandoFin(db, id);
}

export async function uploadDocFormandoFin(
  db: Db,
  formandoId: number,
  tipo: string,
  file: { name: string; mime: string; bytes: Buffer },
  opts: { actorId?: string; viaFormando?: boolean } = {},
) {
  const permitido = new Set(DOCS_FORMANDO_FIN.map(d => d.id));
  if (!permitido.has(tipo)) return { error: "Este documento não faz parte do dossiê financiado." as const };
  const vista = await vistaDocumentosFormandoFin(db, formandoId);
  if (!vista) return { error: "Formando inexistente." as const };
  if (vista.recusados.length && !vista.recusados.includes(tipo)) {
    return { error: "Nesta correcção só pode enviar os documentos que a secretaria recusou." as const };
  }
  const f = await db.query<{ nome: string; apelido: string; turma: string; curso: string }>(
    "SELECT nome, apelido, turma, curso FROM formandos_fin WHERE id = $1",
    [formandoId],
  );
  const p = f.rows[0];
  if (!p) return { error: "Formando inexistente." as const };
  const label = DOCS_FORMANDO_FIN.find(d => d.id === tipo)?.label ?? tipo;
  const stored = await storeDriveFile(db, opts.actorId, file, {
    kind: "formando-doc",
    regime: "fin",
    formando: `${p.nome} ${p.apelido}`.trim(),
    turma: p.turma,
    label,
    itemId: String(formandoId),
  });
  const hoje = new Date().toISOString().slice(0, 10);
  await db.query(
    `INSERT INTO formando_docs (regime, formando_id, doc_id, ok, file_name, data, drive_file_id, drive_url, estado, observacao, validated_by, validated_at)
     VALUES ('fin', $1, $2, false, $3, $4, $5, $6, 'pendente', '', NULL, NULL)
     ON CONFLICT (regime, formando_id, doc_id) DO UPDATE SET
       ok = false, file_name = EXCLUDED.file_name, data = EXCLUDED.data,
       drive_file_id = EXCLUDED.drive_file_id, drive_url = EXCLUDED.drive_url,
       estado = 'pendente', observacao = '', validated_by = NULL, validated_at = NULL, updated_at = now()`,
    [formandoId, tipo, stored.name, hoje, stored.id, stored.openUrl ?? ""],
  );
  const merged = await mergeDocsJson(db, formandoId, { [tipo]: { ok: false, data: hoje } });
  await db.query("UPDATE formandos_fin SET docs = $2::jsonb WHERE id = $1", [formandoId, JSON.stringify(merged)]);
  await db.query(
    "INSERT INTO formando_notas (regime, formando_id, autor, actor_id, texto) VALUES ('fin', $1, $2, $3, $4)",
    [formandoId, opts.viaFormando ? "Formando" : "Sistema", opts.actorId ?? null, `Documento enviado · ${label}`],
  );
  return { ok: true as const, nome: stored.name, url: stored.openUrl ?? "" };
}

async function mergeDocsJson(db: Db, formandoId: number, patch: Record<string, { ok: boolean; data: string }>) {
  const row = await db.query<{ docs: unknown }>("SELECT docs FROM formandos_fin WHERE id = $1", [formandoId]);
  const base = row.rows[0]?.docs && typeof row.rows[0].docs === "object"
    ? { ...(row.rows[0].docs as Record<string, unknown>) }
    : {};
  for (const [k, v] of Object.entries(patch)) base[k] = v;
  return base;
}

export async function validarDocFormandoFin(
  db: Db,
  formandoId: number,
  docId: string,
  actor: { id: string; name: string },
) {
  const row = await db.query<{ doc_id: string }>(
    "SELECT doc_id FROM formando_docs WHERE regime = 'fin' AND formando_id = $1 AND doc_id = $2",
    [formandoId, docId],
  );
  if (!row.rows[0]) return false;
  const hoje = new Date().toISOString().slice(0, 10);
  await db.query(
    `UPDATE formando_docs SET ok = true, estado = 'validado', observacao = '', data = $4,
       validated_by = $3, validated_at = now(), updated_at = now()
     WHERE regime = 'fin' AND formando_id = $1 AND doc_id = $2`,
    [formandoId, docId, actor.id, hoje],
  );
  const merged = await mergeDocsJson(db, formandoId, { [docId]: { ok: true, data: hoje } });
  await db.query("UPDATE formandos_fin SET docs = $2::jsonb WHERE id = $1", [formandoId, JSON.stringify(merged)]);
  await db.query(
    "INSERT INTO formando_notas (regime, formando_id, autor, actor_id, texto) VALUES ('fin', $1, $2, $3, $4)",
    [formandoId, actor.name, actor.id, `Documento validado · ${docId}`],
  );
  return true;
}

export async function recusarDocFormandoFin(
  db: Db,
  formandoId: number,
  docId: string,
  observacao: string,
  actor: { id: string; name: string },
) {
  const obs = observacao.trim().slice(0, 500);
  if (!obs) return { ok: false as const, error: "Escreva o que está incorrecto." };
  const row = await db.query<{ doc_id: string }>(
    "SELECT doc_id FROM formando_docs WHERE regime = 'fin' AND formando_id = $1 AND doc_id = $2",
    [formandoId, docId],
  );
  if (!row.rows[0]) return { ok: false as const, error: "Documento inexistente." };
  await db.query(
    `UPDATE formando_docs SET ok = false, estado = 'recusado', observacao = $4, validated_by = $3, validated_at = now(), updated_at = now()
     WHERE regime = 'fin' AND formando_id = $1 AND doc_id = $2`,
    [formandoId, docId, actor.id, obs],
  );
  const merged = await mergeDocsJson(db, formandoId, { [docId]: { ok: false, data: "" } });
  await db.query("UPDATE formandos_fin SET docs = $2::jsonb WHERE id = $1", [formandoId, JSON.stringify(merged)]);
  await db.query(
    "INSERT INTO formando_notas (regime, formando_id, autor, actor_id, texto) VALUES ('fin', $1, $2, $3, $4)",
    [formandoId, actor.name, actor.id, `Documento recusado · ${docId}: ${obs}`],
  );
  return { ok: true as const };
}

export async function assertFormandoDoUser(db: Db, userId: string, formandoId: number) {
  const row = await db.query<{ id: number }>(
    "SELECT id FROM formandos_fin WHERE id = $1 AND user_id = $2",
    [formandoId, userId],
  );
  return Boolean(row.rows[0]);
}

export function emailTemFormando(email: string) {
  return isEmail(normalizeEmail(email));
}

/**
 * Marcação manual de um documento (ex.: entregue em papel). Fica no dossiê com quem validou e quando,
 * mesmo sem ficheiro, para o rasto de auditoria ser o mesmo do portal.
 */
export async function registarDocManualFin(
  db: Db,
  formandoId: number,
  docId: string,
  ok: boolean,
  actor: { id: string; name: string },
) {
  const hoje = new Date().toISOString().slice(0, 10);
  await db.query(
    `INSERT INTO formando_docs (regime, formando_id, doc_id, ok, file_name, data, estado, observacao, validated_by, validated_at)
     VALUES ('fin', $1, $2, $3, '', $4, $5, $6, $7, now())
     ON CONFLICT (regime, formando_id, doc_id) DO UPDATE SET
       ok = EXCLUDED.ok, data = EXCLUDED.data, estado = EXCLUDED.estado,
       observacao = CASE WHEN formando_docs.file_name = '' THEN EXCLUDED.observacao ELSE formando_docs.observacao END,
       validated_by = EXCLUDED.validated_by, validated_at = now(), updated_at = now()`,
    [formandoId, docId, ok, ok ? hoje : "", ok ? "validado" : "pendente", ok ? "Validado manualmente (sem ficheiro no GesForma)." : "", actor.id],
  );
  await db.query(
    "INSERT INTO formando_notas (regime, formando_id, autor, actor_id, texto) VALUES ('fin', $1, $2, $3, $4)",
    [formandoId, actor.name, actor.id, `${ok ? "Documento marcado como entregue" : "Documento desmarcado"} · ${docId}`],
  );
}
