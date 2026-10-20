/** Ficheiros guardados pelo GesForma: na Drive da entidade ou, sem ligação e fora da Vercel, em disco local. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { config, newToken, onVercel } from "./config.js";
import type { Db } from "./db/pool.js";
import { assertUpload, sanitizeFileName } from "./ficheirosValidacao.js";
import {
  DRIVE_FILES_URL, driveComToken, driveCreds, driveOfflineMessage, ensureFolderPath, folderSegments, garantirPastaFilha,
  isNotFound, tokenDrive, usableToken, type DriveContext,
} from "./googleDrive.js";
import {
  apagarRegistoFicheiro, ficheiroDrive, gravarPastaDaTurmaSeVazia, inserirFicheiroGoogle, inserirFicheiroLocal,
  listarFicheirosDrive, pastaDaTurma, relocalizarFicheiro, type DriveFileRow,
} from "./repos/drive.js";

const DRIVE_FILES = DRIVE_FILES_URL;
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

/** Tipo servido ao browser: vem da extensão (já validada no upload), nunca do MIME que o cliente enviou. */
const MIME_POR_EXTENSAO: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", heic: "image/heic",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  mp4: "video/mp4", webm: "video/webm",
};

export function mimeServido(name: string) {
  const ext = (/\.([a-z0-9]+)$/i.exec(name)?.[1] ?? "").toLowerCase();
  return MIME_POR_EXTENSAO[ext] ?? "application/octet-stream";
}

/** Só PDFs, imagens e vídeos abrem no browser; o resto descarrega-se. */
export function abreNoBrowser(mime: string) {
  return mime === "application/pdf" || mime.startsWith("image/") || mime.startsWith("video/");
}

function driveDir() {
  mkdirSync(config.driveDir, { recursive: true });
  return config.driveDir;
}

async function uploadToGoogle(token: string, parentId: string, name: string, mime: string, bytes: Buffer) {
  const boundary = `gesforma_${newToken(8)}`;
  const meta = JSON.stringify({ name, parents: [parentId] });
  const head = Buffer.from(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([head, bytes, tail]);
  const url = `${DRIVE_UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,webContentLink`;
  return driveComToken<{
    id: string;
    name: string;
    mimeType?: string;
    size?: string;
    webViewLink?: string;
    webContentLink?: string;
  }>(token, url, {
    method: "POST",
    headers: {
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": String(body.length),
    },
    body,
  });
}

/**
 * Grava (ou substitui, pelo nome) um ficheiro gerado numa pasta da Drive, sem registo em `drive_files`:
 * serve para o ZIP do dossiê, que não deve voltar a entrar na exportação seguinte.
 */
export async function substituirNaPasta(token: string, parentId: string, name: string, mime: string, bytes: Buffer) {
  const q = [`name='${name.replace(/'/g, "\\'")}'`, `'${parentId}' in parents`, "trashed=false"].join(" and ");
  const params = new URLSearchParams({ q, fields: "files(id)", pageSize: "1", supportsAllDrives: "true", includeItemsFromAllDrives: "true" });
  const found = await driveComToken<{ files?: { id: string }[] }>(token, `${DRIVE_FILES}?${params.toString()}`);
  const existente = found.files?.[0]?.id;
  if (existente) {
    return driveComToken<{ id: string; webViewLink?: string }>(
      token,
      `${DRIVE_UPLOAD}/${encodeURIComponent(existente)}?uploadType=media&supportsAllDrives=true&fields=id,webViewLink`,
      { method: "PATCH", headers: { "Content-Type": mime, "Content-Length": String(bytes.length) }, body: bytes },
    );
  }
  return uploadToGoogle(token, parentId, name, mime, bytes);
}

export function mapFile(row: DriveFileRow) {
  const openUrl = row.stored_in === "google" && row.web_view_link
    ? row.web_view_link
    : `/api/v1/drive/files/${row.id}/content`;
  return {
    id: row.id,
    name: row.name,
    mimeType: row.mime_type ?? "application/octet-stream",
    sizeBytes: row.size_bytes ?? 0,
    webViewLink: row.web_view_link,
    openUrl,
    folderPath: row.folder_path ?? "",
    kind: row.kind,
    regime: row.regime,
    turma: row.turma,
    formando: row.formando,
    label: row.label,
    storedIn: row.stored_in === "google" ? "google" as const : "local" as const,
    createdAt: row.created_at,
    contratoId: row.contrato_id ?? null,
  };
}

/** Resumo do conteúdo guardado com cada ficheiro (para não reenviar um PDF gerado igual ao que já lá está). */
export function resumoConteudo(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

export async function storeDriveFile(
  db: Db,
  actorId: string | undefined,
  file: { name: string; mime: string; bytes: Buffer },
  ctx: DriveContext,
  opts: { gerado?: boolean } = {},
) {
  const name = sanitizeFileName(file.name);
  assertUpload(name, file.bytes, Boolean(opts.gerado));
  const id = newToken(16);
  const sha256 = resumoConteudo(file.bytes);
  const creds = await driveCreds(db);
  const pathLabel = ctx.folderPath?.trim() || folderSegments(ctx, creds.folderName).join(" / ");
  const { token, reason } = await usableToken(db);

  if (token) {
    let parent: string;
    try {
      parent = ctx.parentDriveId?.trim()
        || await ensureFolderPath(db, token, folderSegments(ctx, creds.folderName), creds.folderId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (isNotFound(err)) {
        throw new Error("A conta Google não consegue usar essa pasta. Em Configurações apague o ID da pasta, desligue a conta e volte a ligar.");
      }
      throw err instanceof Error ? err : new Error(msg || "upload recusado");
    }
    const uploaded = await uploadToGoogle(token, parent, name, file.mime, file.bytes);
    try {
      await inserirFicheiroGoogle(db, {
        id, driveId: uploaded.id, name: uploaded.name ?? name, mime: uploaded.mimeType ?? file.mime,
        size: Number(uploaded.size ?? file.bytes.length), webViewLink: uploaded.webViewLink ?? null,
        webContentLink: uploaded.webContentLink ?? null, folderPath: pathLabel,
        kind: ctx.kind || "documento", regime: ctx.regime ?? null, turma: ctx.turma ?? null,
        formando: ctx.formando ?? null, label: ctx.label ?? null, criadoPor: actorId ?? null, sha256, contratoId: ctx.contratoId ?? null,
      });
    } catch (err) {
      // Sem registo o ficheiro ficava órfão na Drive (ninguém o via nem apagava): sai com o erro.
      await apagarNaGoogle(token, uploaded.id).catch(() => undefined);
      throw err;
    }
  } else if (!onVercel) {
    const localName = `${id}-${name}`;
    const localPath = join(driveDir(), localName);
    writeFileSync(localPath, file.bytes);
    try {
      await inserirFicheiroLocal(db, {
        id, name, mime: file.mime, size: file.bytes.length, folderPath: pathLabel,
        kind: ctx.kind || "documento", regime: ctx.regime ?? null, turma: ctx.turma ?? null,
        formando: ctx.formando ?? null, label: ctx.label ?? null, localPath: localName, criadoPor: actorId ?? null, sha256,
        contratoId: ctx.contratoId ?? null,
      });
    } catch (err) {
      if (existsSync(localPath)) unlinkSync(localPath);
      throw err;
    }
  } else {
    console.error(JSON.stringify({
      msg: "drive sem token; anexo recusado",
      reason: reason ?? "sem-ligacao",
    }));
    throw new Error(driveOfflineMessage(reason));
  }

  return mapFile((await ficheiroDrive(db, id))!);
}

export async function listDriveFiles(db: Db, q: DriveContext & { limit?: number }) {
  const rows = await listarFicheirosDrive(db, { ...q, limite: Math.min(q.limit ?? 80, 200) });
  return rows.map(mapFile);
}

export async function getDriveFile(db: Db, id: string) {
  const row = await ficheiroDrive(db, id);
  return row ? mapFile(row) : null;
}

/** `timeoutMs`: limite da descarga na Google (a exportação do dossiê não pode ficar presa num ficheiro). */
export async function readDriveContent(db: Db, id: string, opts: { timeoutMs?: number } = {}) {
  const file = await ficheiroDrive(db, id);
  if (!file) return null;
  if (file.stored_in === "local" && file.local_path) {
    const path = join(driveDir(), file.local_path);
    if (!existsSync(path)) return null;
    return {
      name: file.name,
      mime: mimeServido(file.name),
      bytes: readFileSync(path),
      redirect: null as string | null,
    };
  }
  const token = await tokenDrive(db);
  if (!token || !file.drive_id) {
    return { name: file.name, mime: mimeServido(file.name), bytes: null, redirect: file.web_view_link };
  }
  const res = await fetch(`${DRIVE_FILES}/${file.drive_id}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
    ...(opts.timeoutMs ? { signal: AbortSignal.timeout(opts.timeoutMs) } : {}),
  });
  if (!res.ok) {
    return { name: file.name, mime: mimeServido(file.name), bytes: null, redirect: file.web_view_link };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { name: file.name, mime: mimeServido(file.name), bytes: buf, redirect: null as string | null };
}

/** Apaga um ficheiro na Drive. Já não existir (404) conta como apagado; qualquer outra falha é erro. */
async function apagarNaGoogle(token: string, driveId: string) {
  const res = await fetch(`${DRIVE_FILES}/${encodeURIComponent(driveId)}?supportsAllDrives=true`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) throw new Error("Não foi possível apagar o ficheiro na Drive.");
}

export async function apagarFicheiroSubstituido(db: Db, id: string) {
  const file = await ficheiroDrive(db, id);
  if (!file) return false;
  if (file.stored_in === "google" && file.drive_id) {
    const token = await tokenDrive(db).catch(() => null);
    if (token) {
      await apagarNaGoogle(token, file.drive_id).catch(() => {
        throw new Error("Não foi possível apagar o ficheiro anterior na Drive.");
      });
    }
  }
  if (file.local_path) {
    const path = join(driveDir(), file.local_path);
    if (existsSync(path)) unlinkSync(path);
  }
  await apagarRegistoFicheiro(db, id);
  return true;
}

/**
 * Apaga o ficheiro e o registo. O registo só sai depois de a Google confirmar (ou responder 404):
 * sem ligação ou com erro, fica tudo como estava e o pedido falha, para não ficar um órfão na Drive.
 */
export async function deleteDriveFile(db: Db, id: string) {
  const file = await ficheiroDrive(db, id);
  if (!file) return false;
  if (file.stored_in === "google" && file.drive_id) {
    const token = await tokenDrive(db).catch(() => null);
    if (!token) throw new Error("Sem ligação ao Google Drive: o ficheiro não foi apagado. Volte a ligar a conta em Configurações.");
    await apagarNaGoogle(token, file.drive_id);
  }
  if (file.local_path) {
    const path = join(driveDir(), file.local_path);
    if (existsSync(path)) unlinkSync(path);
  }
  await apagarRegistoFicheiro(db, id);
  return true;
}

/** Move um ficheiro para a pasta da turma, dentro de uma subpasta com o nome da pessoa. */
export async function relocateDriveFile(db: Db, fileId: string, dest: {
  regime: "gold" | "fin";
  turmaId: number;
  turmaNome: string;
  pessoa: string;
}) {
  const file = await ficheiroDrive(db, fileId);
  if (!file) return false;
  const tag = dest.regime === "fin" ? "Financiada" : "Gold";
  const pessoa = sanitizeFileName(dest.pessoa.trim() || "Formando");
  const turmaNome = dest.turmaNome.trim() || `Turma ${dest.turmaId}`;
  const pathLabel = ["Turmas", tag, turmaNome, pessoa].join(" / ");
  const token = await tokenDrive(db).catch(() => null);
  if (token && file.stored_in === "google" && file.drive_id) {
    const gravada = await pastaDaTurma(db, dest.regime, dest.turmaId);
    const pasta = gravada || await ensureFolderPath(db, token, ["Turmas", tag, turmaNome]);
    if (pasta && pasta !== gravada) await gravarPastaDaTurmaSeVazia(db, dest.regime, dest.turmaId, pasta);
    const child = await garantirPastaFilha(token, pasta, pessoa);
    const current = await driveComToken<{ parents?: string[] }>(
      token,
      `${DRIVE_FILES}/${encodeURIComponent(file.drive_id)}?fields=parents&supportsAllDrives=true`,
    );
    const remove = (current.parents ?? []).filter(id => id !== child);
    const params = new URLSearchParams({ addParents: child, supportsAllDrives: "true", fields: "id,parents" });
    if (remove.length) params.set("removeParents", remove.join(","));
    await driveComToken(token, `${DRIVE_FILES}/${encodeURIComponent(file.drive_id)}?${params.toString()}`, { method: "PATCH" });
  }
  await relocalizarFicheiro(db, fileId, pathLabel, turmaNome, pessoa);
  return true;
}
