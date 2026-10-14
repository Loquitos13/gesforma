import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { config, newToken, oauthRedirectUri, siteOriginFromHeaders } from "../config.js";
import {
  deleteDriveFile, getDriveFile, listDriveFiles, readDriveContent, storeDriveFile,
} from "../driveFicheiros.js";
import {
  disconnectGoogle, driveCreds, exchangeCode, getDriveStatus, googleAuthUrl, googleConfigured, purgeExpiredStates, saveDriveConfig, saveGoogleAccount,
} from "../googleDrive.js";
import { garantirBolsaFormador } from "../driveArvore.js";
import { consumirEstadoOauth, criarEstadoOauth } from "../repos/sessoes.js";
import { validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

// Google Drive: ligação OAuth, configuração (admin) e ficheiros.

const idTexto = z.object({ id: z.string().trim().min(1).max(200) });
const vazio = (v: unknown) => (v === "" ? undefined : v);
const listaQuery = z.object({
  kind: z.string().max(60).optional(),
  regime: z.preprocess(vazio, z.enum(["gold", "fin"]).optional()),
  turma: z.string().max(160).optional(),
  formando: z.string().max(80).optional(),
}).passthrough();
const configSchema = z.object({
  clientId: z.string().trim().max(300).optional(),
  clientSecret: z.string().trim().max(400).optional(),
  folderId: z.string().trim().max(200).optional(),
  folderName: z.string().trim().max(200).optional(),
  scope: z.enum(["drive.file", "drive"]).optional(),
});

function driveCallbackUri(req: FastifyRequest) {
  return oauthRedirectUri(req.headers, "/api/v1/drive/oauth/callback", process.env.GOOGLE_REDIRECT_URI ?? "");
}

function publicOrigin(req: FastifyRequest) {
  return siteOriginFromHeaders(req.headers);
}

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.get("/v1/drive/status", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const status = await getDriveStatus(db);
    return {
      ...status,
      redirectUri: driveCallbackUri(req),
      loginRedirectUri: oauthRedirectUri(req.headers, "/api/v1/auth/google/callback", process.env.GOOGLE_LOGIN_REDIRECT_URI ?? ""),
    };
  });

  app.put("/v1/drive/config", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: configSchema }, req);
    if (!v) return;
    const body = v.body;
    try {
      await saveDriveConfig(db, body);
      await audit(db, req.actor!.id, "drive.config", "drive_config", "google", req.ip);
      const status = await getDriveStatus(db);
      return {
        ...status,
        redirectUri: driveCallbackUri(req),
        loginRedirectUri: oauthRedirectUri(req.headers, "/api/v1/auth/google/callback", process.env.GOOGLE_LOGIN_REDIRECT_URI ?? ""),
      };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "configuração recusada" });
    }
  });

  app.get("/v1/drive/oauth/start", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const creds = await driveCreds(db);
    if (!googleConfigured(creds)) {
      return reply.redirect(`${publicOrigin(req)}/area-formando?destino=${encodeURIComponent("/gesforma/configuracoes")}&drive=sem-cliente`);
    }
    await purgeExpiredStates(db);
    const state = newToken(24);
    const exp = new Date(Date.now() + 10 * 60_000).toISOString();
    const redirectUri = driveCallbackUri(req);
    await criarEstadoOauth(db, { state, userId: req.actor!.id, redirectTo: `${publicOrigin(req)}/gesforma/configuracoes?drive=ligado`, expiraEm: exp, redirectUri });
    return reply.redirect(googleAuthUrl(state, { ...creds, redirectUri }));
  });

  app.get("/v1/drive/oauth/callback", async (req, reply) => {
    const q = req.query as { code?: string; state?: string; error?: string };
    const home = publicOrigin(req);
    const fail = (reason: string) => reply.redirect(`${home}/area-formando?destino=${encodeURIComponent("/gesforma/configuracoes")}&drive=${encodeURIComponent(reason)}`);
    if (q.error) return fail(q.error);
    if (!q.code || !q.state) return fail("pedido-invalido");
    const st = await consumirEstadoOauth(db, q.state);
    if (!st || !st.user_id || (st.purpose && st.purpose !== "drive")) return fail("estado-expirado");
    try {
      const creds = await driveCreds(db);
      if (!googleConfigured(creds)) return fail("sem-cliente");
      const tokens = await exchangeCode(q.code, creds, st.oauth_redirect_uri || driveCallbackUri(req));
      const saved = await saveGoogleAccount(db, tokens);
      await audit(db, st.user_id, "drive.connect", "oauth_account", "google", req.ip, { email: saved.email });
      return reply.redirect(st.redirect_to || `${config.appOrigin}/gesforma/configuracoes?drive=ligado`);
    } catch (err) {
      app.log.error(err);
      return fail("oauth-falhou");
    }
  });

  app.post("/v1/drive/disconnect", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await disconnectGoogle(db);
    await audit(db, req.actor!.id, "drive.disconnect", "oauth_account", "google", req.ip);
    return { ok: true };
  });

  app.get("/v1/drive/files", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: listaQuery }, req);
    if (!v) return;
    const q = v.query;
    const files = await listDriveFiles(db, {
      kind: q.kind ?? "",
      regime: q.regime,
      turma: q.turma,
      formando: q.formando,
    });
    return { files };
  });

  app.get("/v1/drive/files/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idTexto }, req);
    if (!v) return;
    const id = v.params.id;
    const file = await getDriveFile(db, id);
    if (!file) return reply.code(404).send({ error: "ficheiro inexistente" });
    return { file };
  });

  app.get("/v1/drive/files/:id/content", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idTexto }, req);
    if (!v) return;
    const id = v.params.id;
    const content = await readDriveContent(db, id);
    if (!content) return reply.code(404).send({ error: "ficheiro inexistente" });
    if (content.redirect && !content.bytes) return reply.redirect(content.redirect);
    reply.header("Content-Type", content.mime);
    const disp = content.mime === "text/html" ? "attachment" : "inline";
    reply.header("Content-Disposition", `${disp}; filename="${content.name.replace(/"/g, "")}"`);
    return reply.send(content.bytes);
  });

  app.delete("/v1/drive/files/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idTexto }, req);
    if (!v) return;
    const id = v.params.id;
    const ok = await deleteDriveFile(db, id);
    if (!ok) return reply.code(404).send({ error: "ficheiro inexistente" });
    await audit(db, req.actor!.id, "drive.delete", "drive_file", id, req.ip);
    return { ok: true };
  });

  app.post("/v1/drive/files", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    let name = "ficheiro";
    let mime = "application/octet-stream";
    let bytes: Buffer | null = null;
    const fields: Record<string, string> = {};
    try {
      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          name = part.filename || name;
          mime = part.mimetype || mime;
          bytes = await part.toBuffer();
        } else {
          fields[part.fieldname] = String(part.value ?? "");
        }
      }
    } catch {
      return reply.code(400).send({ error: "upload inválido" });
    }
    if (!bytes) return reply.code(400).send({ error: "ficheiro em falta" });
    try {
      const kind = (fields.kind || "documento").slice(0, 40);
      const bolsa = kind === "formador-doc" ? await garantirBolsaFormador(db, fields.formando || "") : null;
      const file = await storeDriveFile(db, req.actor?.id, { name, mime, bytes }, {
        kind,
        regime: fields.regime === "fin" ? "fin" : fields.regime === "gold" ? "gold" : undefined,
        turma: fields.turma?.slice(0, 120),
        formando: fields.formando?.slice(0, 80),
        label: fields.label?.slice(0, 160),
        fase: fields.fase?.slice(0, 20),
        itemId: fields.itemId?.slice(0, 80),
        parentDriveId: bolsa?.pastaId,
        folderPath: bolsa?.path,
      });
      await audit(db, req.actor!.id, "drive.upload", "drive_file", file.id, req.ip, {
        name: file.name, kind: file.kind, storedIn: file.storedIn,
      });
      return { file };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "upload recusado" });
    }
  });
}
