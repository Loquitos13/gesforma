import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { config, newToken, oauthRedirectUri, siteOriginFromHeaders } from "../config.js";
import {
  abreNoBrowser, deleteDriveFile, listDriveFiles, mapFile, readDriveContent, storeDriveFile,
} from "../driveFicheiros.js";
import {
  disconnectGoogle, driveCreds, exchangeCode, getDriveStatus, googleAuthUrl, googleConfigured, purgeExpiredStates, saveDriveConfig, saveGoogleAccount,
} from "../googleDrive.js";
import { garantirBolsaFormador } from "../driveArvore.js";
import { pode } from "../permissoes/capacidades.js";
import { ficheiroDrive, turmaEntre, type DriveFileRow } from "../repos/drive.js";
import { consumirEstadoOauth, criarEstadoOauth } from "../repos/sessoes.js";
import { nomesDoFormador, turmasDoFormador } from "../sessaoAcesso.js";
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

type Actor = NonNullable<FastifyRequest["actor"]>;

/** Ficheiros sem regime (conteúdos gerais) vêem-se em ambos; os outros só por quem trabalha nesse regime. */
function veRegime(role: string, regime: string | null) {
  return (regime !== "gold" && regime !== "fin") || pode(role, regime === "fin" ? "fin.ver" : "gold.ver");
}

async function nomesMeus(db: Deps["db"], actor: Actor) {
  return new Set([...await nomesDoFormador(db, actor.email, actor.name, actor.id)].map(n => n.toLowerCase()));
}

/**
 * Ficheiros de turma que o formador atribuído lê: os materiais que a equipa junta à turma.
 * Fora ficam os de dados pessoais, mesmo com turma: formando-doc, pip, certificado, dtp (dossiê com
 * documentos de formandos), contrato, recibos (Pagamentos), comprovativos e documentos da pré-inscrição.
 */
const KINDS_TURMA_FORMADOR = ["documento", "conteudo"];

/** O formador está atribuído à turma com este nome, neste regime (a mesma noção que sessaoAcesso.ts). */
async function minhaTurma(db: Deps["db"], actor: Actor, regime: string | null, turma: string | null) {
  if ((regime !== "gold" && regime !== "fin") || !turma) return false;
  const minhas = await turmasDoFormador(db, actor);
  return turmaEntre(db, regime, turma, [...minhas[regime]]);
}

/** O formador só vê o que enviou, os documentos da sua ficha e os materiais das suas turmas. */
async function podeVerFicheiro(db: Deps["db"], actor: Actor, f: DriveFileRow) {
  if (actor.role !== "formador") return veRegime(actor.role, f.regime);
  if (f.created_by === actor.id) return true;
  if (KINDS_TURMA_FORMADOR.includes(f.kind)) return minhaTurma(db, actor, f.regime, f.turma);
  return f.kind === "formador-doc" && (await nomesMeus(db, actor)).has(String(f.formando ?? "").trim().toLowerCase());
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

  const soAdmin: typeof requireAuth = (req, reply) => {
    if (!requireAuth(req, reply)) return false;
    if (req.actor!.role === "admin") return true;
    reply.code(403).send({ error: "Sem permissão para esta operação." });
    return false;
  };

  app.put("/v1/drive/config", async (req, reply) => {
    if (!soAdmin(req, reply)) return;
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
    if (!soAdmin(req, reply)) return;
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
    if (!soAdmin(req, reply)) return;
    await disconnectGoogle(db);
    await audit(db, req.actor!.id, "drive.disconnect", "oauth_account", "google", req.ip);
    return { ok: true };
  });

  app.get("/v1/drive/files", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: listaQuery }, req);
    if (!v) return;
    const q = v.query;
    const actor = req.actor!;
    if (actor.role === "formador") {
      // Materiais de uma turma sua (`?regime=&turma=`).
      if (q.turma && !q.formando) {
        if (!(await minhaTurma(db, actor, q.regime ?? null, q.turma))) return { files: [] };
        const porKind = await Promise.all(KINDS_TURMA_FORMADOR.map(kind => listDriveFiles(db, { kind, regime: q.regime, turma: q.turma })));
        return { files: porKind.flat().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) };
      }
      // Os documentos da própria ficha (o que a área do formador pede).
      if (!q.formando || !(await nomesMeus(db, actor)).has(q.formando.trim().toLowerCase())) return { files: [] };
      return { files: await listDriveFiles(db, { kind: "formador-doc", regime: q.regime, formando: q.formando }) };
    }
    if (q.regime && !veRegime(actor.role, q.regime)) return reply.code(403).send({ error: "Sem acesso aos ficheiros deste regime." });
    const files = await listDriveFiles(db, {
      kind: q.kind ?? "",
      regime: q.regime,
      turma: q.turma,
      formando: q.formando,
    });
    return { files: files.filter(f => veRegime(actor.role, f.regime)) };
  });

  app.get("/v1/drive/files/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idTexto }, req);
    if (!v) return;
    const row = await ficheiroDrive(db, v.params.id);
    if (!row || !(await podeVerFicheiro(db, req.actor!, row))) return reply.code(404).send({ error: "ficheiro inexistente" });
    return { file: mapFile(row) };
  });

  app.get("/v1/drive/files/:id/content", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idTexto }, req);
    if (!v) return;
    const id = v.params.id;
    const row = await ficheiroDrive(db, id);
    if (!row || !(await podeVerFicheiro(db, req.actor!, row))) return reply.code(404).send({ error: "ficheiro inexistente" });
    const content = await readDriveContent(db, id);
    if (!content) return reply.code(404).send({ error: "ficheiro inexistente" });
    if (content.redirect && !content.bytes) return reply.redirect(content.redirect);
    reply.header("Content-Type", content.mime);
    const disp = abreNoBrowser(content.mime) ? "inline" : "attachment";
    reply.header("Content-Disposition", `${disp}; filename="${content.name.replace(/"/g, "")}"`);
    return reply.send(content.bytes);
  });

  app.delete("/v1/drive/files/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idTexto }, req);
    if (!v) return;
    const id = v.params.id;
    const row = await ficheiroDrive(db, id);
    if (!row || !veRegime(req.actor!.role, row.regime)) return reply.code(404).send({ error: "ficheiro inexistente" });
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
      if (kind === "formador-doc" && req.actor!.role === "formador" && !(await nomesMeus(db, req.actor!)).has((fields.formando ?? "").trim().toLowerCase())) {
        return reply.code(403).send({ error: "O formador só envia documentos da própria ficha." });
      }
      const regimeUp = fields.regime === "fin" ? "fin" : fields.regime === "gold" ? "gold" : null;
      if (req.actor!.role !== "formador" && !veRegime(req.actor!.role, regimeUp)) {
        return reply.code(403).send({ error: "Sem acesso aos ficheiros deste regime." });
      }
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
