import { randomBytes } from "node:crypto";
import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { DOCS_FORMANDO_FIN } from "../../src/partilhado/dossierDocs.js";
import { storeDriveFile } from "./driveFicheiros.js";
import { erroFicheiroPublico } from "./ficheirosValidacao.js";
import { readFormandoDocs } from "./pii.js";
import {
  decidirDoc, definirTokenFin, docDoFormando, docEnviado, docManual, docsDoFormando, fichaFinDoUtilizador,
  finPorSincronizar, formandoFinPorTokenId, gravarDocsJsonFin, inserirNota, pessoaFin, sincronizarDocsFin,
} from "./repos/formandosDocs.js";
import { isEmail, normalizeEmail } from "./security.js";
import { hojeLisboa } from "./datas.js";

/** Documentos de elegibilidade da Financiada: ligação pessoal, envio, validação e recusa. */

export function formandoFinDocsUrl(token: string) {
  return `${config.appOrigin.replace(/\/$/, "")}/documentos-formando/${token}`;
}

function hoje() {
  return hojeLisboa();
}

export async function ensureFinDocsToken(db: Db, formandoId: number) {
  const p = await pessoaFin(db, formandoId);
  const current = p?.docs_token?.trim();
  if (current) return current;
  const token = randomBytes(18).toString("base64url");
  const again = await definirTokenFin(db, formandoId, token);
  return again?.docs_token || token;
}

function dataIso(v: string | Date | null | undefined) {
  if (!v) return "";
  return String(v instanceof Date ? v.toISOString() : v).slice(0, 10);
}

export async function vistaDocumentosFormandoFin(db: Db, formandoId: number) {
  const pessoa = await pessoaFin(db, formandoId);
  if (!pessoa) return null;
  const token = await ensureFinDocsToken(db, formandoId);
  const stored = await docsDoFormando(db, "fin", formandoId);
  const byId = new Map(stored.map(r => [r.doc_id, r]));
  const docsJson = readFormandoDocs(pessoa as unknown as Record<string, unknown>);
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
      validadoEm: row?.validated_at ? dataIso(row.validated_at) : leg?.data ?? "",
      validadoPor: row?.validator_name ?? "",
    };
  });
  const recusados = documentos.filter(d => d.estado === "recusado").map(d => d.id);
  return {
    formandoId: Number(pessoa.id),
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
  const row = await formandoFinPorTokenId(db, token);
  if (!row) return null;
  return vistaDocumentosFormandoFin(db, Number(row.id));
}

async function mergeDocsJson(db: Db, formandoId: number, patch: Record<string, { ok: boolean; data: string }>) {
  const p = await pessoaFin(db, formandoId);
  const base = p?.docs && typeof p.docs === "object" ? { ...(p.docs as Record<string, unknown>) } : {};
  for (const [k, v] of Object.entries(patch)) base[k] = v;
  await gravarDocsJsonFin(db, formandoId, base);
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
  if (opts.viaFormando) {
    const erroFicheiro = erroFicheiroPublico(file.name, file.bytes);
    if (erroFicheiro) return { error: erroFicheiro };
  }
  const atual = await docDoFormando(db, "fin", formandoId, tipo);
  if (opts.viaFormando && atual?.estado === "validado") {
    return { error: "Este documento já foi validado pela secretaria. Para o substituir, contacte a secretaria." as const };
  }
  const vista = await vistaDocumentosFormandoFin(db, formandoId);
  if (!vista) return { error: "Formando inexistente." as const };
  if (vista.recusados.length && !vista.recusados.includes(tipo)) {
    return { error: "Nesta correcção só pode enviar os documentos que a secretaria recusou." as const };
  }
  const p = await pessoaFin(db, formandoId);
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
  const data = hoje();
  await docEnviado(db, "fin", formandoId, tipo, { nome: stored.name, data, driveFileId: stored.id, driveUrl: stored.openUrl ?? "" });
  await mergeDocsJson(db, formandoId, { [tipo]: { ok: false, data } });
  await inserirNota(db, "fin", formandoId, opts.viaFormando ? "Formando" : "Sistema", opts.actorId ?? null, `Documento enviado · ${label}`);
  return { ok: true as const, nome: stored.name, url: stored.openUrl ?? "" };
}

export async function validarDocFormandoFin(db: Db, formandoId: number, docId: string, actor: { id: string; name: string }) {
  if (!await docDoFormando(db, "fin", formandoId, docId)) return false;
  const data = hoje();
  await decidirDoc(db, "fin", formandoId, docId, { validado: true, data }, actor.id);
  await mergeDocsJson(db, formandoId, { [docId]: { ok: true, data } });
  await inserirNota(db, "fin", formandoId, actor.name, actor.id, `Documento validado · ${docId}`);
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
  if (!await docDoFormando(db, "fin", formandoId, docId)) return { ok: false as const, error: "Documento inexistente." };
  await decidirDoc(db, "fin", formandoId, docId, { validado: false, observacao: obs }, actor.id);
  await mergeDocsJson(db, formandoId, { [docId]: { ok: false, data: "" } });
  await inserirNota(db, "fin", formandoId, actor.name, actor.id, `Documento recusado · ${docId}: ${obs}`);
  return { ok: true as const };
}

export async function assertFormandoDoUser(db: Db, userId: string, formandoId: number) {
  return Boolean(await fichaFinDoUtilizador(db, userId, formandoId));
}

export function emailTemFormando(email: string) {
  return isEmail(normalizeEmail(email));
}

/**
 * Marcação manual de um documento (ex.: entregue em papel). Fica no dossiê com quem validou e quando,
 * mesmo sem ficheiro, para o rasto de auditoria ser o mesmo do portal.
 */
export async function registarDocManualFin(db: Db, formandoId: number, docId: string, ok: boolean, actor: { id: string; name: string }) {
  await docManual(db, "fin", formandoId, docId, ok, hoje(), actor.id);
  await inserirNota(db, "fin", formandoId, actor.name, actor.id, `${ok ? "Documento marcado como entregue" : "Documento desmarcado"} · ${docId}`);
}

/**
 * Fichas antigas da Financiada guardam os documentos só no JSON cifrado. Antes de contar documentos
 * em SQL, copiam-se os dados como certos para formando_docs (uma vez por ficha; repete-se se a ficha mudar).
 */
export async function sincronizarDocsAntigosFin(db: Db) {
  const linhas = await finPorSincronizar(db);
  for (const l of linhas) {
    const docs = readFormandoDocs(l as unknown as Record<string, unknown>);
    const oks = DOCS_FORMANDO_FIN.flatMap(d => {
      const v = docs[d.id] as { ok?: unknown; data?: unknown } | undefined;
      return v && typeof v === "object" && v.ok ? [{ docId: d.id, data: String(v.data ?? "").slice(0, 10) || hoje() }] : [];
    });
    await sincronizarDocsFin(db, Number(l.id), oks);
  }
  return linhas.length;
}
