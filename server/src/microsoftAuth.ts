import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { openSecret, sealSecret } from "./secretBox.js";

const GRAPH_ME = "https://graph.microsoft.com/v1.0/me";
const LOGIN_SCOPES = "openid profile email User.Read";

/** `common` aceita qualquer tenant; a ENA usa o seu tenant id para só deixar entrar a organização. */
const DEFAULT_TENANT = "common";

export type MicrosoftCreds = {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  redirectUri: string;
  fromEnv: boolean;
};

type ConfigRow = {
  client_id: string | null;
  client_secret: string | null;
  tenant_id: string | null;
};

function authBase(tenantId: string) {
  return `https://login.microsoftonline.com/${encodeURIComponent(tenantId || DEFAULT_TENANT)}/oauth2/v2.0`;
}

export async function microsoftCreds(db: Db): Promise<MicrosoftCreds> {
  const row = await db.query<ConfigRow>(
    "SELECT client_id, client_secret, tenant_id FROM microsoft_config WHERE id = 'microsoft'",
  );
  const stored = row.rows[0];
  let storedSecret = "";
  if (stored?.client_secret) {
    try { storedSecret = openSecret(stored.client_secret); } catch { storedSecret = ""; }
  }
  return {
    clientId: config.microsoftClientId || stored?.client_id || "",
    clientSecret: config.microsoftClientSecret || storedSecret,
    tenantId: config.microsoftTenantId || stored?.tenant_id || DEFAULT_TENANT,
    redirectUri: config.microsoftLoginRedirectUri,
    fromEnv: Boolean(config.microsoftClientId && config.microsoftClientSecret),
  };
}

export function microsoftConfigured(creds: MicrosoftCreds) {
  return Boolean(creds.clientId && creds.clientSecret);
}

export async function saveMicrosoftConfig(db: Db, patch: {
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
}) {
  const prev = await microsoftCreds(db);
  const clientId = (patch.clientId ?? prev.clientId).trim();
  const clientSecret = (patch.clientSecret ?? prev.clientSecret).trim();
  const tenantId = (patch.tenantId ?? prev.tenantId).trim() || DEFAULT_TENANT;
  if (clientId.length < 12) throw new Error("Application (client) ID inválido");
  if (clientSecret.length < 12) throw new Error("Client secret em falta");
  if (!/^[\w.-]+$/.test(tenantId)) throw new Error("Directory (tenant) ID inválido");
  await db.query(
    `INSERT INTO microsoft_config (id, client_id, client_secret, tenant_id)
     VALUES ('microsoft', $1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       client_id = EXCLUDED.client_id,
       client_secret = EXCLUDED.client_secret,
       tenant_id = EXCLUDED.tenant_id,
       updated_at = now()`,
    [clientId, sealSecret(clientSecret), tenantId],
  );
  return microsoftCreds(db);
}

export async function disconnectMicrosoft(db: Db) {
  await db.query("DELETE FROM microsoft_config WHERE id = 'microsoft'");
}

export async function getMicrosoftStatus(db: Db) {
  const creds = await microsoftCreds(db);
  const configured = microsoftConfigured(creds);
  return {
    configured,
    redirectUri: creds.redirectUri,
    tenantId: creds.tenantId,
    clientId: creds.clientId,
    hasSecret: Boolean(creds.clientSecret),
    fromEnv: creds.fromEnv,
    hint: configured
      ? "Entrar com Microsoft está activo para quem já existe como utilizador."
      : "Registe a aplicação no Microsoft Entra ID e cole aqui o client ID, o secret e o tenant.",
  };
}

export function microsoftLoginAuthUrl(state: string, creds: MicrosoftCreds) {
  const q = new URLSearchParams({
    client_id: creds.clientId,
    response_type: "code",
    redirect_uri: creds.redirectUri,
    response_mode: "query",
    scope: LOGIN_SCOPES,
    prompt: "select_account",
    state,
  });
  return `${authBase(creds.tenantId)}/authorize?${q.toString()}`;
}

async function microsoftJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: unknown = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { error: text.slice(0, 200) }; }
  if (!res.ok) {
    const err = data as { error?: string | { message?: string }; error_description?: string };
    const msg = err.error_description
      ?? (typeof err.error === "string" ? err.error : err.error?.message)
      ?? `Microsoft ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}

export async function exchangeMicrosoftCode(code: string, creds: MicrosoftCreds) {
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    code,
    redirect_uri: creds.redirectUri,
    grant_type: "authorization_code",
    scope: LOGIN_SCOPES,
  });
  return microsoftJson<{ access_token: string; expires_in: number; token_type: string }>(
    `${authBase(creds.tenantId)}/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
}

/** Contas de organização trazem `mail`; as restantes só o `userPrincipalName`. */
export async function microsoftUserEmail(accessToken: string) {
  const me = await microsoftJson<{ mail?: string | null; userPrincipalName?: string | null }>(
    `${GRAPH_ME}?$select=mail,userPrincipalName`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return me.mail || me.userPrincipalName || null;
}
