/** Google Drive: configuração OAuth, conta ligada e registo dos ficheiros (`drive_files`). */
import { many, one, tabelaRegime, type Consulta, type Regime } from "./sql.js";

export type ConfigDriveRow = {
  client_id: string | null;
  client_secret: string | null;
  folder_id: string | null;
  folder_name: string | null;
  scope: string | null;
};

export type ContaGoogleRow = {
  email: string | null;
  access_token: string;
  refresh_token: string | null;
  expiry: string | null;
  scope: string | null;
  folder_id: string | null;
  folder_name: string | null;
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

export function lerConfigDrive(c: Consulta) {
  return one<ConfigDriveRow>(c, "SELECT client_id, client_secret, folder_id, folder_name, scope FROM drive_config WHERE id = 'google'");
}

export async function gravarConfigDrive(c: Consulta, d: { clientId: string; clientSecretSelado: string; folderId: string | null; folderName: string; scope: string }) {
  await many(c,
    `INSERT INTO drive_config (id, client_id, client_secret, folder_id, folder_name, scope)
     VALUES ('google', $1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET
       client_id = EXCLUDED.client_id, client_secret = EXCLUDED.client_secret, folder_id = EXCLUDED.folder_id,
       folder_name = EXCLUDED.folder_name, scope = EXCLUDED.scope, updated_at = now()`,
    [d.clientId, d.clientSecretSelado, d.folderId, d.folderName, d.scope]);
}

export function contaGoogle(c: Consulta) {
  return one<ContaGoogleRow>(c,
    "SELECT email, access_token, refresh_token, expiry, scope, folder_id, folder_name FROM oauth_accounts WHERE provider = 'google'");
}

export async function gravarContaGoogle(c: Consulta, d: {
  email: string | null; accessSelado: string; refreshSelado: string; expiry: string; scope: string;
  folderId: string | null; folderName: string | null;
}) {
  await many(c,
    `INSERT INTO oauth_accounts (provider, email, access_token, refresh_token, expiry, scope, folder_id, folder_name)
     VALUES ('google', $1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (provider) DO UPDATE SET
       email = EXCLUDED.email, access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token,
       expiry = EXCLUDED.expiry, scope = EXCLUDED.scope, updated_at = now()`,
    [d.email, d.accessSelado, d.refreshSelado, d.expiry, d.scope, d.folderId, d.folderName]);
}

export async function renovarTokenGoogle(c: Consulta, accessSelado: string, expiry: string) {
  await many(c, "UPDATE oauth_accounts SET access_token = $1, expiry = $2, updated_at = now() WHERE provider = 'google'", [accessSelado, expiry]);
}

export async function lembrarPastaRaiz(c: Consulta, folderId: string, folderName: string) {
  await many(c, "UPDATE oauth_accounts SET folder_id = $1, folder_name = $2, updated_at = now() WHERE provider = 'google'", [folderId, folderName]);
}

export async function apagarContaGoogle(c: Consulta) {
  await many(c, "DELETE FROM oauth_accounts WHERE provider = 'google'");
}

export async function apagarEstadosOauthExpirados(c: Consulta) {
  await many(c, "DELETE FROM oauth_states WHERE expires_at < now()");
}

export async function inserirFicheiroGoogle(c: Consulta, f: {
  id: string; driveId: string; name: string; mime: string; size: number; webViewLink: string | null; webContentLink: string | null;
  folderPath: string; kind: string; regime: string | null; turma: string | null; formando: string | null; label: string | null; criadoPor: string | null;
}) {
  await many(c,
    `INSERT INTO drive_files
      (id, drive_id, name, mime_type, size_bytes, web_view_link, web_content_link, folder_path,
       kind, regime, turma, formando, label, stored_in, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'google',$14)`,
    [f.id, f.driveId, f.name, f.mime, f.size, f.webViewLink, f.webContentLink, f.folderPath,
      f.kind, f.regime, f.turma, f.formando, f.label, f.criadoPor]);
}

export async function inserirFicheiroLocal(c: Consulta, f: {
  id: string; name: string; mime: string; size: number; folderPath: string; kind: string;
  regime: string | null; turma: string | null; formando: string | null; label: string | null; localPath: string; criadoPor: string | null;
}) {
  await many(c,
    `INSERT INTO drive_files
      (id, name, mime_type, size_bytes, folder_path, kind, regime, turma, formando, label, stored_in, local_path, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'local',$11,$12)`,
    [f.id, f.name, f.mime, f.size, f.folderPath, f.kind, f.regime, f.turma, f.formando, f.label, f.localPath, f.criadoPor]);
}

export function ficheiroDrive(c: Consulta, id: string) {
  return one<DriveFileRow>(c, "SELECT * FROM drive_files WHERE id = $1", [id]);
}

export function listarFicheirosDrive(c: Consulta, f: { kind?: string; regime?: string; turma?: string; formando?: string; limite: number }) {
  return many<DriveFileRow>(c,
    `SELECT * FROM drive_files
      WHERE ($1::text IS NULL OR kind = $1) AND ($2::text IS NULL OR regime = $2)
        AND ($3::text IS NULL OR turma = $3) AND ($4::text IS NULL OR formando = $4)
      ORDER BY created_at DESC LIMIT $5`,
    [f.kind || null, f.regime || null, f.turma || null, f.formando || null, f.limite]);
}

export async function apagarRegistoFicheiro(c: Consulta, id: string) {
  await many(c, "DELETE FROM drive_files WHERE id = $1", [id]);
}

export async function relocalizarFicheiro(c: Consulta, id: string, folderPath: string, turma: string, formando: string) {
  await many(c, "UPDATE drive_files SET folder_path = $2, turma = $3, formando = $4 WHERE id = $1", [id, folderPath, turma, formando]);
}

export async function pastaDaTurma(c: Consulta, regime: Regime, turmaId: number) {
  const r = await one<{ drive_pasta_id: string }>(c, `SELECT drive_pasta_id FROM ${tabelaRegime("turmas", regime)} WHERE id = $1`, [turmaId]);
  return r?.drive_pasta_id?.trim() ?? "";
}

export async function gravarPastaDaTurmaSeVazia(c: Consulta, regime: Regime, turmaId: number, pasta: string) {
  await many(c, `UPDATE ${tabelaRegime("turmas", regime)} SET drive_pasta_id = $2 WHERE id = $1 AND drive_pasta_id = ''`, [turmaId, pasta]);
}
