import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config, newToken, onVercel } from "./config.js";
import { dtpDriveSegments } from "./dtpPasta.js";
import type { Db } from "./db/pool.js";
import { openSecret, sealSecret } from "./secretBox.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const FOLDER_MIME = "application/vnd.google-apps.folder";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "video/mp4",
  "video/webm",
  "application/octet-stream",
  "text/html",
]);

const ALLOWED_EXT = /\.(pdf|doc|docx|jpe?g|png|mp4|webm|html)$/i;

export type DriveContext = {
  kind: string;
  regime?: string;
  turma?: string;
  formando?: string;
  label?: string;
  fase?: string;
  itemId?: string;
};

export type DriveFileRow = {
  id: string;
  drive_id: string | null;
  name: string;
  mime_type: string | null;
  size_bytes: number | null;
  web_view_link: string | null;
  web_content_link: string | null;
  folder_path: string | null;
  kind: string;
  regime: string | null;
  turma: string | null;
  formando: string | null;
  label: string | null;
  stored_in: string;
  local_path: string | null;
  created_at: string;
};

type AccountRow = {
  email: string | null;
  access_token: string;
  refresh_token: string | null;
  expiry: string | null;
  scope: string | null;
  folder_id: string | null;
  folder_name: string | null;
};

export type DriveCreds = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  folderId: string;
  folderName: string;
  scope: "drive.file" | "drive";
  fromEnv: boolean;
};

type ConfigRow = {
  client_id: string | null;
  client_secret: string | null;
  folder_id: string | null;
  folder_name: string | null;
  scope: string | null;
};

export async function driveCreds(db: Db): Promise<DriveCreds> {
  const row = await db.query<ConfigRow>(
    "SELECT client_id, client_secret, folder_id, folder_name, scope FROM drive_config WHERE id = 'google'",
  );
  const stored = row.rows[0];
  let storedSecret = "";
  if (stored?.client_secret) {
    try { storedSecret = openSecret(stored.client_secret); } catch { storedSecret = ""; }
  }
  return {
    clientId: config.googleClientId || stored?.client_id || "",
    clientSecret: config.googleClientSecret || storedSecret,
    redirectUri: config.googleRedirectUri,
    folderId: config.googleDriveFolderId || stored?.folder_id || "",
    folderName: stored?.folder_name || config.googleDriveFolder,
    scope: config.googleDriveScope === "drive" || stored?.scope === "drive" ? "drive" : "drive.file",
    fromEnv: Boolean(config.googleClientId && config.googleClientSecret),
  };
}

export function googleConfigured(creds?: DriveCreds) {
  if (creds) return Boolean(creds.clientId && creds.clientSecret);
  return Boolean(config.googleClientId && config.googleClientSecret);
}

export async function saveDriveConfig(db: Db, patch: {
  clientId?: string;
  clientSecret?: string;
  folderId?: string;
  folderName?: string;
  scope?: "drive.file" | "drive";
}) {
  const prev = await driveCreds(db);
  const clientId = (patch.clientId ?? prev.clientId).trim();
  const clientSecret = (patch.clientSecret ?? prev.clientSecret).trim();
  const folderId = (patch.folderId ?? prev.folderId).trim();
  const folderName = (patch.folderName ?? prev.folderName).trim() || config.googleDriveFolder;
  const scope = patch.scope ?? prev.scope;
  if (!clientId || clientId.length < 12) throw new Error("Client ID inválido");
  if (!clientSecret || clientSecret.length < 12) throw new Error("Client secret em falta");
  await db.query(
    `INSERT INTO drive_config (id, client_id, client_secret, folder_id, folder_name, scope)
     VALUES ('google', $1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       client_id = EXCLUDED.client_id,
       client_secret = EXCLUDED.client_secret,
       folder_id = EXCLUDED.folder_id,
       folder_name = EXCLUDED.folder_name,
       scope = EXCLUDED.scope,
       updated_at = now()`,
    [clientId, sealSecret(clientSecret), folderId || null, folderName, scope],
  );
  return driveCreds(db);
}

export function googleScopes(creds?: DriveCreds) {
  const scope = creds?.scope ?? config.googleDriveScope;
  const drive = scope === "drive"
    ? "https://www.googleapis.com/auth/drive"
    : "https://www.googleapis.com/auth/drive.file";
  return ["openid", "email", drive];
}

export function googleAuthUrl(state: string, creds: DriveCreds) {
  const q = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: creds.redirectUri,
    response_type: "code",
    scope: googleScopes(creds).join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${q.toString()}`;
}

export function googleLoginAuthUrl(state: string, creds: DriveCreds, redirectUri = config.googleLoginRedirectUri) {
  const q = new URLSearchParams({
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    prompt: "select_account",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${q.toString()}`;
}

export function sanitizeFileName(name: string) {
  const base = name.replace(/[/\\]/g, "").replace(/[^\w.\- ()áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]+/g, "_").trim();
  return (base || "ficheiro").slice(0, 180);
}

export function assertUpload(name: string, mime: string, size: number) {
  if (size <= 0) throw new Error("ficheiro vazio");
  if (size > config.driveMaxBytes) throw new Error("ficheiro acima de 10 MB");
  const okMime = ALLOWED_MIME.has(mime);
  const okExt = ALLOWED_EXT.test(name);
  if (!okMime && !okExt) throw new Error("tipo de ficheiro recusado");
}

function kindFolder(kind: string) {
  const map: Record<string, string> = {
    certificado: "Certificados",
    pip: "PIP",
    simulacao: "Simulacoes",
    "formador-doc": "Formadores",
    conteudo: "Conteudos",
    dtp: "DTP",
    documento: "Documentos",
  };
  return map[kind] ?? sanitizeFileName(kind || "Documentos");
}

export function folderSegments(ctx: DriveContext, rootName = config.googleDriveFolder) {
  const dtp = dtpDriveSegments(ctx, rootName);
  if (dtp) return dtp;
  const segs = [rootName];
  if (ctx.regime === "fin") segs.push("Financiada");
  else if (ctx.regime === "gold") segs.push("Gold");
  if (ctx.turma) segs.push(sanitizeFileName(ctx.turma));
  segs.push(kindFolder(ctx.kind));
  return segs;
}

function driveDir() {
  mkdirSync(config.driveDir, { recursive: true });
  return config.driveDir;
}

async function googleJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: unknown = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text.slice(0, 200) }; }
  if (!res.ok) {
    const err = data as { error?: string | { message?: string } };
    const msg = typeof err.error === "string" ? err.error : err.error?.message ?? `Google ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function exchangeCode(code: string, creds: DriveCreds, redirectUri = creds.redirectUri) {
  const body = new URLSearchParams({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  return googleJson<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
    token_type: string;
  }>(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

async function refreshAccess(refreshToken: string, creds: DriveCreds) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "refresh_token",
  });
  return googleJson<{ access_token: string; expires_in: number; scope?: string }>(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

export async function googleUserEmail(accessToken: string) {
  const info = await googleJson<{ email?: string }>(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return info.email ?? null;
}

async function userEmail(accessToken: string) {
  return googleUserEmail(accessToken);
}

export async function saveGoogleAccount(db: Db, tokens: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}) {
  const email = await userEmail(tokens.access_token);
  const prev = await db.query<AccountRow>(
    "SELECT email, access_token, refresh_token, expiry, scope, folder_id, folder_name FROM oauth_accounts WHERE provider = 'google'",
  );
  const refresh = tokens.refresh_token
    ?? (prev.rows[0]?.refresh_token ? openSecret(prev.rows[0].refresh_token) : "");
  if (!refresh) throw new Error("Google não devolveu refresh token. Volte a ligar a conta.");
  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await db.query(
    `INSERT INTO oauth_accounts (provider, email, access_token, refresh_token, expiry, scope, folder_id, folder_name)
     VALUES ('google', $1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (provider) DO UPDATE SET
       email = EXCLUDED.email,
       access_token = EXCLUDED.access_token,
       refresh_token = EXCLUDED.refresh_token,
       expiry = EXCLUDED.expiry,
       scope = EXCLUDED.scope,
       updated_at = now()`,
    [
      email,
      sealSecret(tokens.access_token),
      sealSecret(refresh),
      expiry,
      tokens.scope ?? googleScopes().join(" "),
      prev.rows[0]?.folder_id ?? null,
      prev.rows[0]?.folder_name ?? null,
    ],
  );
  return { email };
}

async function loadAccount(db: Db) {
  const row = await db.query<AccountRow>(
    "SELECT email, access_token, refresh_token, expiry, scope, folder_id, folder_name FROM oauth_accounts WHERE provider = 'google'",
  );
  return row.rows[0] ?? null;
}

function hintDoDrive(configured: boolean, connected: boolean, email: string | null, reason: string | null) {
  if (!configured) {
    return "Cole o cliente OAuth da Google (ID e secret) e ligue a conta da entidade. Na cloud os ficheiros só ficam no Drive.";
  }
  if (connected && reason) {
    if (/invalid_grant|expired|revoked|invalid_token/i.test(reason)) {
      return "A ligação ao Google expirou. Se o ecrã de consentimento ainda está em teste, passe-o a produção (ou a interno, no Workspace) e volte a ligar a conta. Os anexos seguem para o Drive.";
    }
    return "Não foi possível renovar o acesso ao Google Drive. Volte a ligar a conta em Configurações. Os anexos seguem para o Drive.";
  }
  if (connected) return `Ficheiros da secretaria no Drive de ${email}.`;
  return "Cliente OAuth gravado. Falta ligar a conta Google da ENA.";
}

export async function getDriveStatus(db: Db) {
  const account = await loadAccount(db);
  const creds = await driveCreds(db);
  const configured = googleConfigured(creds);
  const connected = Boolean(account?.refresh_token);
  const access = connected ? await usableToken(db) : { token: null, reason: null as string | null };
  const reason = connected && !access.token ? (access.reason || "sem-token") : null;
  return {
    configured,
    connected,
    email: account?.email ?? null,
    folderName: account?.folder_name ?? creds.folderName,
    folderId: account?.folder_id ?? (creds.folderId || null),
    mode: connected && access.token ? "google" as const : "local" as const,
    redirectUri: creds.redirectUri,
    loginRedirectUri: config.googleLoginRedirectUri,
    clientId: creds.clientId,
    hasSecret: Boolean(creds.clientSecret),
    fromEnv: creds.fromEnv,
    hint: hintDoDrive(configured, connected, account?.email ?? null, reason),
  };
}

async function accessToken(db: Db) {
  const account = await loadAccount(db);
  if (!account?.refresh_token) return null;
  const refresh = openSecret(account.refresh_token);
  const exp = account.expiry ? new Date(account.expiry).getTime() : 0;
  if (exp - 60_000 > Date.now() && account.access_token) {
    try { return openSecret(account.access_token); } catch { /* refresh */ }
  }
  const creds = await driveCreds(db);
  if (!googleConfigured(creds)) return null;
  const next = await refreshAccess(refresh, creds);
  const expiry = new Date(Date.now() + next.expires_in * 1000).toISOString();
  await db.query(
    "UPDATE oauth_accounts SET access_token = $1, expiry = $2, updated_at = now() WHERE provider = 'google'",
    [sealSecret(next.access_token), expiry],
  );
  return next.access_token;
}

async function usableToken(db: Db): Promise<{ token: string | null; reason: string | null }> {
  const creds = await driveCreds(db);
  if (!googleConfigured(creds)) return { token: null, reason: null };
  try {
    const token = await accessToken(db);
    return { token, reason: null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "token recusado";
    return { token: null, reason };
  }
}

function driveOfflineMessage(reason: string | null) {
  if (reason && /invalid_grant|expired|revoked|invalid_token/i.test(reason)) {
    return "A ligação ao Google expirou. Em Configurações volte a ligar a conta. Os ficheiros seguem para o Drive.";
  }
  if (reason) return "Não foi possível falar com o Google Drive. Em Configurações volte a ligar a conta.";
  return "Ligue a conta Google em Configurações. Na cloud os ficheiros só ficam no Drive.";
}

export async function disconnectGoogle(db: Db) {
  const account = await loadAccount(db);
  if (account?.refresh_token) {
    try {
      const token = openSecret(account.refresh_token);
      await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" });
    } catch { /* ignore revoke errors */ }
  }
  await db.query("DELETE FROM oauth_accounts WHERE provider = 'google'");
}

async function driveApi<T>(token: string, url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return googleJson<T>(url, { ...init, headers });
}

function usableFolderId(id: string | null | undefined) {
  const value = (id ?? "").trim();
  if (!value || value === "." || value === "root") return "";
  return value;
}

function isNotFound(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /not found/i.test(msg);
}

/** Listar a raiz com includeItemsFromAllDrives faz o Drive responder 404 «File not found: .». */
export function driveChildListUrl(parentId: string, name: string) {
  const parent = usableFolderId(parentId) || "root";
  const q = [
    `name='${name.replace(/'/g, "\\'")}'`,
    `mimeType='${FOLDER_MIME}'`,
    `'${parent}' in parents`,
    "trashed=false",
  ].join(" and ");
  const params = new URLSearchParams({
    q,
    fields: "files(id,name)",
    pageSize: "5",
    supportsAllDrives: "true",
  });
  if (parent !== "root") params.set("includeItemsFromAllDrives", "true");
  return `${DRIVE_FILES}?${params.toString()}`;
}

export function folderCreateBody(name: string, parentId?: string) {
  const parent = usableFolderId(parentId);
  const body: { name: string; mimeType: string; parents?: string[] } = {
    name,
    mimeType: FOLDER_MIME,
  };
  if (parent) body.parents = [parent];
  return body;
}

async function findChildFolder(token: string, parentId: string, name: string) {
  try {
    const res = await driveApi<{ files?: Array<{ id: string; name: string }> }>(
      token,
      driveChildListUrl(parentId, name),
    );
    return res.files?.[0] ?? null;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

async function createFolder(token: string, name: string, parentId?: string) {
  const created = await driveApi<{ id: string; name: string }>(token, `${DRIVE_FILES}?supportsAllDrives=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(folderCreateBody(name, parentId)),
  });
  if (!created.id) throw new Error("O Drive não devolveu a pasta criada.");
  return created;
}

async function ensureChild(token: string, parentId: string, name: string) {
  const found = await findChildFolder(token, parentId, name);
  if (found?.id) return found.id;
  const created = await createFolder(token, name, parentId);
  return created.id;
}

async function nestFolders(token: string, parentId: string, names: string[]) {
  let parent = parentId;
  for (const name of names) {
    if (!name.trim()) continue;
    parent = await ensureChild(token, parent, name);
  }
  return parent;
}

async function ensureFolderPath(db: Db, token: string, segments: string[], folderId?: string) {
  const account = await loadAccount(db);
  const pinned = usableFolderId(folderId) || usableFolderId(account?.folder_id);
  const rootName = segments[0] ?? config.googleDriveFolder;
  const rest = segments.slice(1).filter(name => name.trim());
  const remember = async (id: string) => {
    await db.query(
      "UPDATE oauth_accounts SET folder_id = $1, folder_name = $2, updated_at = now() WHERE provider = 'google'",
      [id, rootName],
    );
  };
  if (!pinned) {
    const rootId = await ensureChild(token, "root", rootName);
    await remember(rootId);
    return nestFolders(token, rootId, rest);
  }
  try {
    return await nestFolders(token, pinned, rest);
  } catch (err) {
    if (!isNotFound(err)) throw err;
    const rootId = await ensureChild(token, "root", rootName);
    await remember(rootId);
    return nestFolders(token, rootId, rest);
  }
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
  return driveApi<{
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

function mapFile(row: DriveFileRow) {
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
  };
}

export async function storeDriveFile(
  db: Db,
  actorId: string | undefined,
  file: { name: string; mime: string; bytes: Buffer },
  ctx: DriveContext,
) {
  const name = sanitizeFileName(file.name);
  assertUpload(name, file.mime, file.bytes.length);
  const id = newToken(16);
  const creds = await driveCreds(db);
  const pathLabel = folderSegments(ctx, creds.folderName).join(" / ");
  const { token, reason } = await usableToken(db);

  if (token) {
    let parent: string;
    try {
      parent = await ensureFolderPath(db, token, folderSegments(ctx, creds.folderName), creds.folderId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (isNotFound(err)) {
        throw new Error("A conta Google não consegue usar essa pasta. Em Configurações apague o ID da pasta, desligue a conta e volte a ligar.");
      }
      throw err instanceof Error ? err : new Error(msg || "upload recusado");
    }
    const uploaded = await uploadToGoogle(token, parent, name, file.mime, file.bytes);
    await db.query(
      `INSERT INTO drive_files
        (id, drive_id, name, mime_type, size_bytes, web_view_link, web_content_link, folder_path,
         kind, regime, turma, formando, label, stored_in, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'google',$14)`,
      [
        id, uploaded.id, uploaded.name ?? name, uploaded.mimeType ?? file.mime,
        Number(uploaded.size ?? file.bytes.length), uploaded.webViewLink ?? null,
        uploaded.webContentLink ?? null, pathLabel,
        ctx.kind || "documento", ctx.regime ?? null, ctx.turma ?? null,
        ctx.formando ?? null, ctx.label ?? null, actorId ?? null,
      ],
    );
  } else if (!onVercel) {
    const localName = `${id}-${name}`;
    const localPath = join(driveDir(), localName);
    writeFileSync(localPath, file.bytes);
    await db.query(
      `INSERT INTO drive_files
        (id, name, mime_type, size_bytes, folder_path, kind, regime, turma, formando, label,
         stored_in, local_path, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'local',$11,$12)`,
      [
        id, name, file.mime, file.bytes.length, pathLabel,
        ctx.kind || "documento", ctx.regime ?? null, ctx.turma ?? null,
        ctx.formando ?? null, ctx.label ?? null, localName, actorId ?? null,
      ],
    );
  } else {
    console.error(JSON.stringify({
      msg: "drive sem token; anexo recusado",
      reason: reason ?? "sem-ligacao",
    }));
    throw new Error(driveOfflineMessage(reason));
  }

  const row = await db.query<DriveFileRow>("SELECT * FROM drive_files WHERE id = $1", [id]);
  return mapFile(row.rows[0]!);
}

export async function listDriveFiles(db: Db, q: DriveContext & { limit?: number }) {
  const clauses: string[] = ["1=1"];
  const params: unknown[] = [];
  const add = (sql: string, value: string) => {
    params.push(value);
    clauses.push(`${sql} = $${params.length}`);
  };
  if (q.kind) add("kind", q.kind);
  if (q.regime) add("regime", q.regime);
  if (q.turma) add("turma", q.turma);
  if (q.formando) add("formando", q.formando);
  params.push(Math.min(q.limit ?? 80, 200));
  const rows = await db.query<DriveFileRow>(
    `SELECT * FROM drive_files WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC LIMIT $${params.length}`,
    params,
  );
  return rows.rows.map(mapFile);
}

export async function getDriveFile(db: Db, id: string) {
  const row = await db.query<DriveFileRow>("SELECT * FROM drive_files WHERE id = $1", [id]);
  return row.rows[0] ? mapFile(row.rows[0]) : null;
}

export async function readDriveContent(db: Db, id: string) {
  const row = await db.query<DriveFileRow>("SELECT * FROM drive_files WHERE id = $1", [id]);
  const file = row.rows[0];
  if (!file) return null;
  if (file.stored_in === "local" && file.local_path) {
    const path = join(driveDir(), file.local_path);
    if (!existsSync(path)) return null;
    return {
      name: file.name,
      mime: file.mime_type ?? "application/octet-stream",
      bytes: readFileSync(path),
      redirect: null as string | null,
    };
  }
  const token = await accessToken(db);
  if (!token || !file.drive_id) {
    return { name: file.name, mime: file.mime_type ?? "application/octet-stream", bytes: null, redirect: file.web_view_link };
  }
  const res = await fetch(`${DRIVE_FILES}/${file.drive_id}?alt=media&supportsAllDrives=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    return { name: file.name, mime: file.mime_type ?? "application/octet-stream", bytes: null, redirect: file.web_view_link };
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return { name: file.name, mime: file.mime_type ?? "application/octet-stream", bytes: buf, redirect: null as string | null };
}

export async function deleteDriveFile(db: Db, id: string) {
  const row = await db.query<DriveFileRow>("SELECT * FROM drive_files WHERE id = $1", [id]);
  const file = row.rows[0];
  if (!file) return false;
  if (file.stored_in === "google" && file.drive_id) {
    const token = await accessToken(db).catch(() => null);
    if (token) {
      await fetch(`${DRIVE_FILES}/${file.drive_id}?supportsAllDrives=true`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
  }
  if (file.local_path) {
    const path = join(driveDir(), file.local_path);
    if (existsSync(path)) unlinkSync(path);
  }
  await db.query("DELETE FROM drive_files WHERE id = $1", [id]);
  return true;
}

export function purgeExpiredStates(db: Db) {
  return db.query("DELETE FROM oauth_states WHERE expires_at < now()");
}

async function shareFolder(token: string, fileId: string, email: string) {
  await driveApi(token, `${DRIVE_FILES}/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role: "writer", type: "user", emailAddress: email }),
  });
}

function nomesNoCronograma(cronograma: unknown, extra: string[]) {
  const nomes = new Set(extra.map(n => n.trim()).filter(Boolean));
  const lista = Array.isArray(cronograma) ? cronograma : [];
  for (const item of lista) {
    if (!item || typeof item !== "object") continue;
    const row = item as { formadores?: unknown; formador?: unknown };
    if (Array.isArray(row.formadores)) {
      for (const n of row.formadores) if (typeof n === "string" && n.trim()) nomes.add(n.trim());
    } else if (typeof row.formador === "string" && row.formador.trim()) {
      nomes.add(row.formador.trim());
    }
  }
  return [...nomes];
}

/** Pasta da turma (formandos, formadores e admins) e dossiê à parte (só secretaria e admins). */
export async function syncTurmaDriveAccess(db: Db, input: {
  regime: "gold" | "fin";
  turmaId: number;
  nome: string;
  formador?: string;
  formadores?: string[];
  cronograma?: unknown;
}) {
  const token = await accessToken(db);
  if (!token) return { ok: false as const, reason: "drive" };
  const tag = input.regime === "fin" ? "Financiada" : "Gold";
  const nome = input.nome.trim() || `Turma ${input.turmaId}`;
  const pasta = await ensureFolderPath(db, token, ["Turmas", tag, nome]);
  const dossie = await ensureFolderPath(db, token, ["Dossies", tag, nome]);
  const table = input.regime === "gold" ? "turmas_gold" : "turmas_fin";
  await db.query(`UPDATE ${table} SET drive_pasta_id = $2, drive_dossie_id = $3 WHERE id = $1`, [input.turmaId, pasta, dossie]);

  const admins = await db.query<{ email: string }>(
    "SELECT email FROM users WHERE role = 'admin' AND active = true AND email <> ''",
  );
  const secretaria = await db.query<{ email: string }>(
    "SELECT email FROM users WHERE role IN ('admin', 'secretaria') AND active = true AND email <> ''",
  );
  const formandos = input.regime === "gold"
    ? await db.query<{ email: string }>("SELECT email FROM formandos_gold WHERE turma_id = $1 AND email <> ''", [input.turmaId])
    : await db.query<{ email: string }>(
      `SELECT email FROM formandos_fin
        WHERE email <> ''
          AND (turma_id = $1 OR lower(trim(turma)) = lower(trim($2)))`,
      [input.turmaId, nome],
    );
  const nomes = nomesNoCronograma(input.cronograma, [input.formador ?? "", ...(input.formadores ?? [])]);
  const formadores = nomes.length
    ? await db.query<{ email: string }>(
      `SELECT email FROM formadores
        WHERE email <> ''
          AND lower(trim(nome)) IN (SELECT lower(trim(jsonb_array_elements_text($1::jsonb))))`,
      [nomes],
    )
    : { rows: [] as { email: string }[] };

  const turmaEmails = new Set<string>();
  for (const row of [...admins.rows, ...formandos.rows, ...formadores.rows]) {
    const email = row.email.trim().toLowerCase();
    if (email.includes("@")) turmaEmails.add(email);
  }
  for (const email of turmaEmails) {
    await shareFolder(token, pasta, email).catch(() => undefined);
  }
  const dossieEmails = new Set<string>();
  for (const row of secretaria.rows) {
    const email = row.email.trim().toLowerCase();
    if (email.includes("@")) dossieEmails.add(email);
  }
  for (const email of dossieEmails) {
    await shareFolder(token, dossie, email).catch(() => undefined);
  }
  return { ok: true as const, pasta, dossie };
}

/** Move um ficheiro para a pasta da turma, dentro de uma subpasta com o nome da pessoa. */
export async function relocateDriveFile(db: Db, fileId: string, dest: {
  regime: "gold" | "fin";
  turmaId: number;
  turmaNome: string;
  pessoa: string;
}) {
  const found = await db.query<DriveFileRow>("SELECT * FROM drive_files WHERE id = $1", [fileId]);
  const file = found.rows[0];
  if (!file) return false;
  const tag = dest.regime === "fin" ? "Financiada" : "Gold";
  const pessoa = sanitizeFileName(dest.pessoa.trim() || "Formando");
  const turmaNome = dest.turmaNome.trim() || `Turma ${dest.turmaId}`;
  const pathLabel = ["Turmas", tag, turmaNome, pessoa].join(" / ");
  const token = await accessToken(db).catch(() => null);
  if (token && file.stored_in === "google" && file.drive_id) {
    const table = dest.regime === "gold" ? "turmas_gold" : "turmas_fin";
    const pastaRow = await db.query<{ drive_pasta_id: string }>(
      `SELECT drive_pasta_id FROM ${table} WHERE id = $1`,
      [dest.turmaId],
    );
    let pasta = pastaRow.rows[0]?.drive_pasta_id?.trim() ?? "";
    if (!pasta) pasta = await ensureFolderPath(db, token, ["Turmas", tag, turmaNome]);
    if (pasta && pasta !== pastaRow.rows[0]?.drive_pasta_id) {
      await db.query(`UPDATE ${table} SET drive_pasta_id = $2 WHERE id = $1 AND drive_pasta_id = ''`, [dest.turmaId, pasta]);
    }
    const child = await ensureChild(token, pasta, pessoa);
    const current = await driveApi<{ parents?: string[] }>(
      token,
      `${DRIVE_FILES}/${encodeURIComponent(file.drive_id)}?fields=parents&supportsAllDrives=true`,
    );
    const remove = (current.parents ?? []).filter(id => id !== child);
    const params = new URLSearchParams({ addParents: child, supportsAllDrives: "true", fields: "id,parents" });
    if (remove.length) params.set("removeParents", remove.join(","));
    await driveApi(token, `${DRIVE_FILES}/${encodeURIComponent(file.drive_id)}?${params.toString()}`, { method: "PATCH" });
  }
  await db.query(
    "UPDATE drive_files SET folder_path = $2, turma = $3, formando = $4 WHERE id = $1",
    [fileId, pathLabel, turmaNome, pessoa],
  );
  return true;
}
