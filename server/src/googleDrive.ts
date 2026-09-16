import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { config, newToken } from "./config.js";
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
]);

const ALLOWED_EXT = /\.(pdf|doc|docx|jpe?g|png|mp4|webm)$/i;

export type DriveContext = {
  kind: string;
  regime?: string;
  turma?: string;
  formando?: string;
  label?: string;
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

export function googleConfigured() {
  return Boolean(config.googleClientId && config.googleClientSecret);
}

export function googleScopes() {
  const drive = config.googleDriveScope === "drive"
    ? "https://www.googleapis.com/auth/drive"
    : "https://www.googleapis.com/auth/drive.file";
  return ["openid", "email", drive];
}

export function googleAuthUrl(state: string) {
  const q = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleRedirectUri,
    response_type: "code",
    scope: googleScopes().join(" "),
    access_type: "offline",
    prompt: "consent",
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

export function folderSegments(ctx: DriveContext) {
  const segs = [config.googleDriveFolder];
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

export async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    redirect_uri: config.googleRedirectUri,
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

async function refreshAccess(refreshToken: string) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    grant_type: "refresh_token",
  });
  return googleJson<{ access_token: string; expires_in: number; scope?: string }>(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
}

async function userEmail(accessToken: string) {
  const info = await googleJson<{ email?: string }>(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return info.email ?? null;
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
      prev.rows[0]?.folder_id ?? (config.googleDriveFolderId || null),
      prev.rows[0]?.folder_name ?? config.googleDriveFolder,
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

export async function getDriveStatus(db: Db) {
  const account = await loadAccount(db);
  const connected = Boolean(account?.refresh_token);
  return {
    configured: googleConfigured(),
    connected,
    email: account?.email ?? null,
    folderName: account?.folder_name ?? config.googleDriveFolder,
    folderId: account?.folder_id ?? null,
    mode: connected ? "google" as const : "local" as const,
    hint: !googleConfigured()
      ? "Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET para ligar o Drive da entidade. Até lá os ficheiros ficam no servidor."
      : connected
        ? `Ficheiros da secretaria no Drive de ${account?.email}.`
        : "A conta Google da entidade ainda não está ligada. Os uploads ficam no servidor até ligar.",
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
  const next = await refreshAccess(refresh);
  const expiry = new Date(Date.now() + next.expires_in * 1000).toISOString();
  await db.query(
    "UPDATE oauth_accounts SET access_token = $1, expiry = $2, updated_at = now() WHERE provider = 'google'",
    [sealSecret(next.access_token), expiry],
  );
  return next.access_token;
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

async function findChildFolder(token: string, parentId: string, name: string) {
  const q = [
    `name='${name.replace(/'/g, "\\'")}'`,
    `mimeType='${FOLDER_MIME}'`,
    `'${parentId}' in parents`,
    "trashed=false",
  ].join(" and ");
  const res = await driveApi<{ files?: Array<{ id: string; name: string }> }>(
    token,
    `${DRIVE_FILES}?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=5`,
  );
  return res.files?.[0] ?? null;
}

async function createFolder(token: string, name: string, parentId?: string) {
  return driveApi<{ id: string; name: string }>(token, `${DRIVE_FILES}?supportsAllDrives=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      parents: parentId ? [parentId] : undefined,
    }),
  });
}

async function ensureFolderPath(db: Db, token: string, segments: string[]) {
  const account = await loadAccount(db);
  let parent = config.googleDriveFolderId || account?.folder_id || "root";
  if (!config.googleDriveFolderId && (!account?.folder_id || account.folder_id === "root")) {
    const existing = parent === "root"
      ? await findChildFolder(token, "root", segments[0] ?? config.googleDriveFolder)
      : { id: parent, name: account?.folder_name ?? config.googleDriveFolder };
    const root = existing ?? await createFolder(token, segments[0] ?? config.googleDriveFolder);
    parent = root.id;
    await db.query(
      "UPDATE oauth_accounts SET folder_id = $1, folder_name = $2, updated_at = now() WHERE provider = 'google'",
      [parent, segments[0] ?? config.googleDriveFolder],
    );
  }
  const rest = config.googleDriveFolderId || account?.folder_id
    ? segments.slice(1)
    : segments.slice(1);
  for (const name of rest) {
    const found = await findChildFolder(token, parent, name);
    const folder = found ?? await createFolder(token, name, parent);
    parent = folder.id;
  }
  return parent;
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
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
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
    storedIn: row.stored_in as "google" | "local",
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
  const pathLabel = folderSegments(ctx).join(" / ");
  const token = googleConfigured() ? await accessToken(db).catch(() => null) : null;

  if (token) {
    const parent = await ensureFolderPath(db, token, folderSegments(ctx));
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
  } else {
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
