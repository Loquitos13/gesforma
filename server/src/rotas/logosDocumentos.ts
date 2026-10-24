import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { LOGO_MAX_BYTES, LogoErro } from "../entidadeLogo.js";
import { apagarLogoDocumento, CHAVE_DGERT, chavePrograma, guardarLogoDocumento, infoLogoDocumento, obterLogoDocumento } from "../logosDocumentos.js";
import { idNum, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

// Logótipo da DGERT (Configurações › Entidade) e imagens públicas dos logótipos dos documentos da Financiada.
// O do programa carrega-se em rotas/catalogos.ts (Edição de cursos › Programas).

/** O ficheiro do pedido multipart (só um), ou null depois de responder 400. */
export async function lerFicheiroLogo(req: FastifyRequest, reply: FastifyReply) {
  let ficheiro: { nome: string; bytes: Buffer } | null = null;
  try {
    for await (const part of req.parts({ limits: { fileSize: LOGO_MAX_BYTES + 1 } })) {
      if (part.type === "file") ficheiro = { nome: part.filename || "logotipo", bytes: await part.toBuffer() };
    }
  } catch {
    reply.code(400).send({ error: "O logótipo passa de 1 MB ou o envio falhou." });
    return null;
  }
  if (!ficheiro?.bytes.length) {
    reply.code(400).send({ error: "ficheiro em falta" });
    return null;
  }
  return ficheiro;
}

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.get("/v1/configuracoes/logo-dgert", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return { logo: await infoLogoDocumento(db, CHAVE_DGERT) };
  });

  app.post("/v1/configuracoes/logo-dgert", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const ficheiro = await lerFicheiroLogo(req, reply);
    if (!ficheiro) return;
    try {
      const logo = await guardarLogoDocumento(db, CHAVE_DGERT, ficheiro);
      await audit(db, req.actor!.id, "entidade.logo_dgert", "app_settings", "entidade", req.ip, { nome: logo?.nome, tamanho: logo?.tamanho });
      return { logo };
    } catch (err) {
      if (err instanceof LogoErro) return reply.code(400).send({ error: err.message });
      throw err;
    }
  });

  app.delete("/v1/configuracoes/logo-dgert", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await apagarLogoDocumento(db, CHAVE_DGERT);
    await audit(db, req.actor!.id, "entidade.logo_dgert_apagar", "app_settings", "entidade", req.ip);
    return { ok: true };
  });

  /** Públicas (são os logótipos que saem impressos nos documentos): para a pré-visualização no backoffice. */
  async function servir(req: FastifyRequest, reply: FastifyReply, chave: string) {
    const logo = await obterLogoDocumento(db, chave);
    if (!logo) return reply.code(404).send({ error: "sem logótipo" });
    return reply
      .header("cache-control", "public, max-age=300")
      .header("cross-origin-resource-policy", "cross-origin")
      .header("x-content-type-options", "nosniff")
      .type(logo.mime).send(logo.bytes);
  }
  app.get("/v1/public/logos/dgert", async (req, reply) => servir(req, reply, CHAVE_DGERT));
  app.get("/v1/public/logos/programa/:id", async (req, reply) => {
    const v = validar(reply, { params: z.object({ id: idNum }) }, req);
    if (!v) return;
    return servir(req, reply, chavePrograma(v.params.id));
  });
}
