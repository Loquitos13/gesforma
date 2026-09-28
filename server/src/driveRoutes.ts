import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config, newToken } from "./config.js";
import type { Db } from "./db/pool.js";
import {
  deleteDriveFile,
  disconnectGoogle,
  driveCreds,
  exchangeCode,
  getDriveFile,
  getDriveStatus,
  googleAuthUrl,
  googleConfigured,
  listDriveFiles,
  purgeExpiredStates,
  readDriveContent,
  saveDriveConfig,
  saveGoogleAccount,
  storeDriveFile,
} from "./googleDrive.js";

function publicOrigin(req: FastifyRequest) {
  const origin = req.headers.origin;
  if (origin) return origin.replace(/\/$/, "");
  return config.appOrigin.replace(/\/$/, "");
}

export function registerDriveRoutes(
  app: FastifyInstance,
  db: Db,
  helpers: {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => boolean;
    audit: (
      db: Db,
      actorId: string | undefined,
      action: string,
      entity: string,
      entityId?: string,
      ip?: string,
      meta?: Record<string, unknown>,
    ) => Promise<void>;
  },
) {
  const { requireAuth, audit } = helpers;

  app.get("/v1/drive/status", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return getDriveStatus(db);
  });

  app.put("/v1/drive/config", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const body = (req.body ?? {}) as {
      clientId?: string;
      clientSecret?: string;
      folderId?: string;
      folderName?: string;
      scope?: "drive.file" | "drive";
    };
    try {
      await saveDriveConfig(db, body);
      await audit(db, req.actor!.id, "drive.config", "drive_config", "google", req.ip);
      return getDriveStatus(db);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "configuração recusada" });
    }
  });

  app.get("/v1/drive/oauth/start", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const creds = await driveCreds(db);
    if (!googleConfigured(creds)) {
      return reply.redirect(`${publicOrigin(req)}/?drive=sem-cliente`);
    }
    await purgeExpiredStates(db);
    const state = newToken(24);
    const exp = new Date(Date.now() + 10 * 60_000).toISOString();
    await db.query(
      "INSERT INTO oauth_states (state, user_id, redirect_to, expires_at) VALUES ($1, $2, $3, $4)",
      [state, req.actor!.id, `${publicOrigin(req)}/?drive=ligado`, exp],
    );
    return reply.redirect(googleAuthUrl(state, creds));
  });

  app.get("/v1/drive/oauth/callback", async (req, reply) => {
    const q = req.query as { code?: string; state?: string; error?: string };
    const fail = (reason: string) => reply.redirect(`${config.appOrigin}/?drive=${encodeURIComponent(reason)}`);
    if (q.error) return fail(q.error);
    if (!q.code || !q.state) return fail("pedido-invalido");
    const row = await db.query<{ user_id: string; redirect_to: string | null }>(
      "SELECT user_id, redirect_to FROM oauth_states WHERE state = $1 AND expires_at > now()",
      [q.state],
    );
    const st = row.rows[0];
    await db.query("DELETE FROM oauth_states WHERE state = $1", [q.state]);
    if (!st) return fail("estado-expirado");
    try {
      const creds = await driveCreds(db);
      if (!googleConfigured(creds)) return fail("sem-cliente");
      const tokens = await exchangeCode(q.code, creds);
      const saved = await saveGoogleAccount(db, tokens);
      await audit(db, st.user_id, "drive.connect", "oauth_account", "google", req.ip, { email: saved.email });
      return reply.redirect(st.redirect_to || `${config.appOrigin}/?drive=ligado`);
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
    const q = req.query as Record<string, string | undefined>;
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
    const id = String((req.params as { id: string }).id);
    const file = await getDriveFile(db, id);
    if (!file) return reply.code(404).send({ error: "ficheiro inexistente" });
    return { file };
  });

  app.get("/v1/drive/files/:id/content", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = String((req.params as { id: string }).id);
    const content = await readDriveContent(db, id);
    if (!content) return reply.code(404).send({ error: "ficheiro inexistente" });
    if (content.redirect && !content.bytes) return reply.redirect(content.redirect);
    reply.header("Content-Type", content.mime);
    reply.header("Content-Disposition", `inline; filename="${content.name.replace(/"/g, "")}"`);
    return reply.send(content.bytes);
  });

  app.delete("/v1/drive/files/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = String((req.params as { id: string }).id);
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
      const file = await storeDriveFile(db, req.actor?.id, { name, mime, bytes }, {
        kind: (fields.kind || "documento").slice(0, 40),
        regime: fields.regime === "fin" ? "fin" : fields.regime === "gold" ? "gold" : undefined,
        turma: fields.turma?.slice(0, 120),
        formando: fields.formando?.slice(0, 80),
        label: fields.label?.slice(0, 160),
        fase: fields.fase?.slice(0, 20),
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
