import { config } from "./config.js";
import { dtpDriveSegments } from "./dtpPasta.js";
import type { Db } from "./db/pool.js";
import { sanitizeFileName } from "./ficheirosValidacao.js";
import {
  apagarContaGoogle, apagarEstadosOauthExpirados, contaGoogle, gravarConfigDrive, gravarContaGoogle, lembrarPastaRaiz,
  lerConfigDrive, renovarTokenGoogle,
} from "./repos/drive.js";
import { openSecret, sealSecret } from "./secretBox.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
export const DRIVE_FILES_URL = DRIVE_FILES;
export const SHORTCUT_MIME_DRIVE = "application/vnd.google-apps.shortcut";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export type DriveContext = {
  kind: string;
  regime?: string;
  turma?: string;
  formando?: string;
  label?: string;
  fase?: string;
  itemId?: string;
  parentDriveId?: string;
  folderPath?: string;
  /** PDF de um contrato assinado (fica com a visibilidade do contrato). */
  contratoId?: number;
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

export async function driveCreds(db: Db): Promise<DriveCreds> {
  const stored = await lerConfigDrive(db);
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
  await gravarConfigDrive(db, { clientId, clientSecretSelado: sealSecret(clientSecret), folderId: folderId || null, folderName, scope });
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

/** Email da conta Google, só se a Google o deu como verificado (senão não prova quem entra). */
export async function googleUserEmail(accessToken: string) {
  const info = await googleJson<{ email?: string; verified_email?: boolean }>(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return info.verified_email === true ? info.email ?? null : null;
}

export async function saveGoogleAccount(db: Db, tokens: {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}) {
  const email = await googleUserEmail(tokens.access_token);
  const prev = await contaGoogle(db);
  const refresh = tokens.refresh_token
    ?? (prev?.refresh_token ? openSecret(prev.refresh_token) : "");
  if (!refresh) throw new Error("Google não devolveu refresh token. Volte a ligar a conta.");
  const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  await gravarContaGoogle(db, {
    email,
    accessSelado: sealSecret(tokens.access_token),
    refreshSelado: sealSecret(refresh),
    expiry,
    scope: tokens.scope ?? googleScopes().join(" "),
    folderId: prev?.folder_id ?? null,
    folderName: prev?.folder_name ?? null,
  });
  return { email };
}

async function loadAccount(db: Db) {
  return contaGoogle(db);
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

export async function tokenDrive(db: Db) {
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
  await renovarTokenGoogle(db, sealSecret(next.access_token), expiry);
  return next.access_token;
}

export async function usableToken(db: Db): Promise<{ token: string | null; reason: string | null }> {
  const creds = await driveCreds(db);
  if (!googleConfigured(creds)) return { token: null, reason: null };
  try {
    const token = await tokenDrive(db);
    return { token, reason: null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "token recusado";
    return { token: null, reason };
  }
}

export function driveOfflineMessage(reason: string | null) {
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
  await apagarContaGoogle(db);
}

export async function driveComToken<T>(token: string, url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return googleJson<T>(url, { ...init, headers });
}

function usableFolderId(id: string | null | undefined) {
  const value = (id ?? "").trim();
  if (!value || value === "." || value === "root") return "";
  return value;
}

export function isNotFound(err: unknown) {
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
    const res = await driveComToken<{ files?: Array<{ id: string; name: string }> }>(
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
  const created = await driveComToken<{ id: string; name: string }>(token, `${DRIVE_FILES}?supportsAllDrives=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(folderCreateBody(name, parentId)),
  });
  if (!created.id) throw new Error("O Drive não devolveu a pasta criada.");
  return created;
}

export async function renomearItemDrive(token: string, id: string, name: string) {
  await driveComToken(token, `${DRIVE_FILES}/${encodeURIComponent(id)}?supportsAllDrives=true`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function garantirPastaFilha(token: string, parentId: string, name: string, nomesAnteriores: string[] = []) {
  const found = await findChildFolder(token, parentId, name);
  if (found?.id) return found.id;
  for (const antigo of nomesAnteriores) {
    const prev = await findChildFolder(token, parentId, antigo);
    if (!prev?.id) continue;
    await renomearItemDrive(token, prev.id, name);
    return prev.id;
  }
  const created = await createFolder(token, name, parentId);
  return created.id;
}

async function nestFolders(token: string, parentId: string, names: string[]) {
  let parent = parentId;
  for (const name of names) {
    if (!name.trim()) continue;
    parent = await garantirPastaFilha(token, parent, name);
  }
  return parent;
}

export async function ensureFolderPath(db: Db, token: string, segments: string[], folderId?: string) {
  const account = await loadAccount(db);
  const pinned = usableFolderId(folderId) || usableFolderId(account?.folder_id);
  const rootName = segments[0] ?? config.googleDriveFolder;
  const rest = segments.slice(1).filter(name => name.trim());
  const remember = async (id: string) => {
    await lembrarPastaRaiz(db, id, rootName);
  };
  if (!pinned) {
    const rootId = await garantirPastaFilha(token, "root", rootName);
    await remember(rootId);
    return nestFolders(token, rootId, rest);
  }
  try {
    return await nestFolders(token, pinned, rest);
  } catch (err) {
    if (!isNotFound(err)) throw err;
    const rootId = await garantirPastaFilha(token, "root", rootName);
    await remember(rootId);
    return nestFolders(token, rootId, rest);
  }
}

export async function apagarItemGoogle(token: string, driveId: string) {
  const res = await fetch(`${DRIVE_FILES}/${encodeURIComponent(driveId)}?supportsAllDrives=true`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404) throw new Error("Não foi possível apagar o item na Drive.");
}

export function urlMoverDrive(fileId: string, addParent: string, removeParents: string[]) {
  const params = new URLSearchParams({
    addParents: addParent,
    supportsAllDrives: "true",
    fields: "id,parents",
  });
  const remove = [...new Set(removeParents.map(id => id.trim()).filter(id => id && id !== addParent))];
  if (remove.length) params.set("removeParents", remove.join(","));
  return `${DRIVE_FILES}/${encodeURIComponent(fileId)}?${params.toString()}`;
}

export async function moverPastaDrive(token: string, pastaId: string, addParent: string, removeParent = "") {
  const actual = await driveComToken<{ parents?: string[] }>(
    token,
    `${DRIVE_FILES}/${encodeURIComponent(pastaId)}?fields=parents&supportsAllDrives=true`,
  );
  const pais = actual.parents ?? [];
  if (pais.length === 1 && pais[0] === addParent) return { id: pastaId, parents: pais };
  await driveComToken(token, urlMoverDrive(pastaId, addParent, [...pais, removeParent]), { method: "PATCH" });
  return { id: pastaId, parents: [addParent] };
}

export async function criarAtalhoDrive(
  token: string,
  input: { name: string; targetId: string; parentId: string },
) {
  const parent = usableFolderId(input.parentId);
  const body: { name: string; mimeType: string; parents?: string[]; shortcutDetails: { targetId: string } } = {
    name: sanitizeFileName(input.name),
    mimeType: SHORTCUT_MIME_DRIVE,
    shortcutDetails: { targetId: input.targetId },
  };
  if (parent) body.parents = [parent];
  const created = await driveComToken<{ id: string }>(token, `${DRIVE_FILES}?supportsAllDrives=true&fields=id,name`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!created.id) throw new Error("O Drive não devolveu o atalho.");
  return created;
}

export async function raizDoProjecto(db: Db, token: string) {
  const creds = await driveCreds(db);
  return ensureFolderPath(db, token, [creds.folderName], creds.folderId);
}

export type PapelDrive = "writer" | "reader";

export async function partilharPasta(token: string, fileId: string, email: string, role: PapelDrive = "writer") {
  await shareFolder(token, fileId, email, role);
}

export type PermissaoDrive = {
  id: string;
  type?: string;
  role?: string;
  emailAddress?: string;
  permissionDetails?: { inherited?: boolean }[];
};

/** Permissões directas e herdadas de um item (todas as páginas). */
export async function permissoesDoItem(token: string, fileId: string) {
  const todas: PermissaoDrive[] = [];
  let pagina = "";
  do {
    const params = new URLSearchParams({
      supportsAllDrives: "true",
      fields: "nextPageToken,permissions(id,type,role,emailAddress,permissionDetails(inherited))",
      pageSize: "100",
    });
    if (pagina) params.set("pageToken", pagina);
    const r = await driveComToken<{ permissions?: PermissaoDrive[]; nextPageToken?: string }>(
      token, `${DRIVE_FILES}/${encodeURIComponent(fileId)}/permissions?${params.toString()}`,
    );
    todas.push(...(r.permissions ?? []));
    pagina = r.nextPageToken ?? "";
  } while (pagina);
  return todas;
}

/** Tira uma permissão de um item. Já não existir conta como feito. */
export async function revogarPermissao(token: string, fileId: string, permissaoId: string) {
  const res = await fetch(
    `${DRIVE_FILES}/${encodeURIComponent(fileId)}/permissions/${encodeURIComponent(permissaoId)}?supportsAllDrives=true`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok && res.status !== 404) throw new Error("Não foi possível retirar a partilha na Drive.");
}

export function purgeExpiredStates(db: Db) {
  return apagarEstadosOauthExpirados(db);
}

async function shareFolder(token: string, fileId: string, email: string, role: PapelDrive) {
  await driveComToken(token, `${DRIVE_FILES}/${encodeURIComponent(fileId)}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, type: "user", emailAddress: email }),
  });
}
