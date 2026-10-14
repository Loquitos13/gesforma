import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { apagarLogoEntidade, guardarLogoEntidade, infoLogoEntidade, LOGO_MAX_BYTES, LogoErro, obterLogoEntidade } from "../entidadeLogo.js";
import * as repo from "../repos/entidadeLogo.js";
import type { Deps } from "./tipos.js";

// Logótipo da entidade: carregar e apagar (administração), consultar (secretaria) e servir publicamente.

const LOGO_ENA = "/imagens/ena-logo-nobg.png";

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  function soAdmin(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return false;
    if (req.actor!.role !== "admin") {
      reply.code(403).send({ error: "só a administração altera o logótipo" });
      return false;
    }
    return true;
  }

  app.get("/v1/configuracoes/logo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return { logo: await infoLogoEntidade(db) };
  });

  app.post("/v1/configuracoes/logo", async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    let ficheiro: { nome: string; bytes: Buffer } | null = null;
    try {
      for await (const part of req.parts({ limits: { fileSize: LOGO_MAX_BYTES + 1 } })) {
        if (part.type === "file") ficheiro = { nome: part.filename || "logotipo", bytes: await part.toBuffer() };
      }
    } catch {
      return reply.code(400).send({ error: "O logótipo passa de 1 MB ou o envio falhou." });
    }
    if (!ficheiro?.bytes.length) return reply.code(400).send({ error: "ficheiro em falta" });
    try {
      const logo = await guardarLogoEntidade(db, ficheiro);
      await audit(db, req.actor!.id, "entidade.logo", "app_settings", "entidade", req.ip, { nome: logo?.nome, tamanho: logo?.tamanho });
      return { logo };
    } catch (err) {
      if (err instanceof LogoErro) return reply.code(400).send({ error: err.message });
      throw err;
    }
  });

  app.delete("/v1/configuracoes/logo", async (req, reply) => {
    if (!soAdmin(req, reply)) return;
    await apagarLogoEntidade(db);
    await audit(db, req.actor!.id, "entidade.logo_apagar", "app_settings", "entidade", req.ip);
    return { ok: true };
  });

  /** Público (emails, PDF, site). Sem logótipo carregado, redirige para o logótipo ENA do site. */
  app.get("/v1/public/entidade/logo", async (req, reply) => {
    const info = await repo.infoLogo(db);
    if (!info) return reply.code(302).header("cache-control", "public, max-age=300").redirect(LOGO_ENA);
    const etag = `"${info.hash.slice(0, 32)}"`;
    reply
      .header("etag", etag)
      .header("cache-control", "public, max-age=3600")
      .header("cross-origin-resource-policy", "cross-origin")
      .header("x-content-type-options", "nosniff");
    if (req.headers["if-none-match"] === etag) return reply.code(304).send();
    const logo = await obterLogoEntidade(db);
    if (!logo) return reply.code(302).redirect(LOGO_ENA);
    return reply.type(logo.mime).send(logo.bytes);
  });
}
