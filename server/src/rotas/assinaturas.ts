/** Assinatura de contratos (equipa): enviar, reenviar, cancelar, provas, contratos do formando e o selo. */
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { AssinaturaErro } from "../assinaturas/comum.js";
import { gerarAutoAssinado, guardarSelo, infoSelo, SeloErro } from "../assinaturas/selo.js";
import * as servico from "../assinaturas/servico.js";
import { lerEntidade } from "../regrasConfig.js";
import * as repo from "../repos/assinaturas.js";
import { idNum, idParam, regimeIdParam, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const envio = z.object({
  nif: z.string().trim().max(20).optional(),
  prazoDias: z.number().int().min(1).max(60).optional(),
});

const quem = (req: FastifyRequest) => ({ id: req.actor!.id, role: req.actor!.role });

export function meta(req: FastifyRequest) {
  return { ip: req.ip, userAgent: String(req.headers["user-agent"] ?? "") };
}

export function falha(reply: FastifyReply, err: unknown) {
  if (err instanceof AssinaturaErro) return reply.code(err.status).send({ error: err.message });
  if (err instanceof SeloErro) return reply.code(400).send({ error: err.message });
  throw err;
}

export function pdf(reply: FastifyReply, nome: string, bytes: Buffer, anexo = true) {
  const seguro = nome.replace(/[^\w\-. ()]/g, "_").slice(0, 120);
  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `${anexo ? "attachment" : "inline"}; filename="${seguro}"`)
    .header("Cache-Control", "no-store")
    .send(bytes);
}

export async function registar(app: import("fastify").FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;
  const soAdmin = (req: FastifyRequest, reply: FastifyReply) => {
    if (req.actor?.role === "admin") return true;
    reply.code(403).send({ error: "Só a administração gere o certificado do selo." });
    return false;
  };

  app.get("/v1/crm/contratos/:id/assinaturas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    try {
      return { assinaturas: await servico.listarDoContrato(db, quem(req), v.params.id) };
    } catch (err) {
      return falha(reply, err);
    }
  });

  app.post("/v1/crm/contratos/:id/assinatura", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: envio }, req);
    if (!v) return;
    try {
      const a = await servico.enviarParaAssinatura(db, quem(req), v.params.id, v.body, meta(req));
      await audit(db, req.actor!.id, "assinatura.enviar", "contrato", String(v.params.id), req.ip, { assinatura: a.id, nifIndicado: a.nifOrigem === "equipa" });
      return { assinatura: a };
    } catch (err) {
      return falha(reply, err);
    }
  });

  app.get("/v1/assinaturas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    try {
      await servico.assinaturaVisivel(db, quem(req), v.params.id);
      return { assinatura: await servico.detalhe(db, v.params.id) };
    } catch (err) {
      return falha(reply, err);
    }
  });

  app.get("/v1/assinaturas/:id/pdf", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, query: z.object({ versao: z.enum(["original", "assinado"]).default("assinado") }) }, req);
    if (!v) return;
    try {
      const r = await servico.pdfDaAssinatura(db, quem(req), v.params.id, v.query.versao);
      return pdf(reply, r.nome, r.pdf);
    } catch (err) {
      return falha(reply, err);
    }
  });

  app.post("/v1/assinaturas/:id/reenviar", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: z.object({ prazoDias: z.number().int().min(1).max(60).optional() }).default({}) }, req);
    if (!v) return;
    try {
      const a = await servico.reenviar(db, quem(req), v.params.id, v.body.prazoDias, meta(req));
      await audit(db, req.actor!.id, "assinatura.reenviar", "assinatura", String(v.params.id), req.ip);
      return { assinatura: a };
    } catch (err) {
      return falha(reply, err);
    }
  });

  app.post("/v1/assinaturas/:id/cancelar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: z.object({ motivo: z.string().trim().max(300).default("") }).default({}) }, req);
    if (!v) return;
    try {
      const a = await servico.cancelar(db, quem(req), v.params.id, v.body.motivo || "Cancelado pela equipa.", meta(req));
      await audit(db, req.actor!.id, "assinatura.cancelar", "assinatura", String(v.params.id), req.ip);
      return { assinatura: a };
    } catch (err) {
      return falha(reply, err);
    }
  });

  // ─── Contratos de formação na ficha do formando ──────────────────────────────

  app.get("/v1/formandos/:regime/:id/contratos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    try {
      return { contratos: await servico.contratosDoFormando(db, v.params.regime, v.params.id) };
    } catch (err) {
      return falha(reply, err);
    }
  });

  app.post("/v1/formandos/:regime/:id/contratos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam, body: z.object({ templateId: idNum }) }, req);
    if (!v) return;
    try {
      const id = await servico.novoContratoFormando(db, v.params.regime, v.params.id, req.actor!.id, v.body.templateId);
      await audit(db, req.actor!.id, "contrato.create", "contrato", String(id), req.ip, { formando: `${v.params.regime}:${v.params.id}` });
      return { contratoId: id, contratos: await servico.contratosDoFormando(db, v.params.regime, v.params.id) };
    } catch (err) {
      return falha(reply, err);
    }
  });

  // ─── Certificado do selo (administração) ─────────────────────────────────────

  app.get("/v1/assinaturas/selo", async (req, reply) => {
    if (!requireAuth(req, reply) || !soAdmin(req, reply)) return;
    return { selo: await infoSelo(db) };
  });

  app.post("/v1/assinaturas/selo", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!requireAuth(req, reply) || !soAdmin(req, reply)) return;
    let bytes: Buffer | null = null;
    let senha = "";
    try {
      for await (const part of req.parts()) {
        if (part.type === "file") bytes = await part.toBuffer();
        else if (part.fieldname === "senha") senha = String(part.value ?? "");
      }
    } catch {
      return reply.code(400).send({ error: "Upload inválido." });
    }
    if (!bytes?.length) return reply.code(400).send({ error: "Escolha o ficheiro .p12 ou .pfx." });
    if (bytes.length > 200_000) return reply.code(400).send({ error: "O ficheiro é demasiado grande para um certificado." });
    try {
      const selo = await guardarSelo(db, bytes, senha);
      await audit(db, req.actor!.id, "selo.carregar", "assinatura_selo", "1", req.ip, { titular: selo?.titular, fingerprint: selo?.fingerprint });
      return { selo };
    } catch (err) {
      return falha(reply, err);
    }
  });

  app.post("/v1/assinaturas/selo/gerar", { config: { rateLimit: { max: 3, timeWindow: "1 minute" } } }, async (req, reply) => {
    if (!requireAuth(req, reply) || !soAdmin(req, reply)) return;
    const entidade = await lerEntidade(db);
    const { p12, senha } = gerarAutoAssinado(entidade.nomeCurto || entidade.nome || "ENA");
    const selo = await guardarSelo(db, p12, senha);
    await audit(db, req.actor!.id, "selo.gerar", "assinatura_selo", "1", req.ip, { fingerprint: selo?.fingerprint });
    return { selo };
  });

  app.delete("/v1/assinaturas/selo", async (req, reply) => {
    if (!requireAuth(req, reply) || !soAdmin(req, reply)) return;
    await repo.apagarSelo(db);
    await audit(db, req.actor!.id, "selo.apagar", "assinatura_selo", "1", req.ip);
    return { ok: true };
  });
}
