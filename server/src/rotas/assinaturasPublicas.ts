/** Assinatura de contratos (público): a ligação pessoal do signatário e a verificação por código. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import * as publico from "../assinaturas/publico.js";
import { falha, meta, pdf } from "./assinaturas.js";
import type { Deps } from "./tipos.js";

const tokenParam = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{30,60}$/, "ligação inválida") });
const codigoParam = z.object({ codigo: z.string().trim().max(20) });
const assinarBody = z.object({
  metodo: z.enum(["desenhada", "escrita"]),
  imagem: z.string().max(420_000).optional(),
  nomeEscrito: z.string().trim().max(160).optional(),
  codigo: z.string().trim().regex(/^\d{6}$/, "o código tem 6 dígitos"),
  aceito: z.literal(true, { errorMap: () => ({ message: "confirme que leu o documento" }) }),
});

const LIMITE = (max: number) => ({ config: { rateLimit: { max, timeWindow: "1 minute" } } });

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db } = deps;
  const comToken = (req: { params: unknown }) => tokenParam.safeParse(req.params);

  app.get("/v1/public/assinar/:token", LIMITE(30), async (req, reply) => {
    const p = comToken(req);
    if (!p.success) return reply.code(404).send({ error: "Ligação inválida." });
    try {
      return await publico.verPedido(db, p.data.token, meta(req));
    } catch (err) {
      return falha(reply, err);
    }
  });

  app.get("/v1/public/assinar/:token/pdf", LIMITE(20), async (req, reply) => {
    const p = comToken(req);
    if (!p.success) return reply.code(404).send({ error: "Ligação inválida." });
    const versao = (req.query as { versao?: string }).versao === "assinado" ? "assinado" : "original";
    try {
      const r = await publico.pdfPublico(db, p.data.token, versao);
      return pdf(reply, r.nome, r.pdf, (req.query as { ver?: string }).ver !== "1");
    } catch (err) {
      return falha(reply, err);
    }
  });

  app.post("/v1/public/assinar/:token/codigo", LIMITE(5), async (req, reply) => {
    const p = comToken(req);
    if (!p.success) return reply.code(404).send({ error: "Ligação inválida." });
    try {
      return await publico.pedirCodigo(db, p.data.token, meta(req));
    } catch (err) {
      return falha(reply, err);
    }
  });

  app.post("/v1/public/assinar/:token/assinar", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } }, bodyLimit: 512 * 1024 }, async (req, reply) => {
    const p = comToken(req);
    if (!p.success) return reply.code(404).send({ error: "Ligação inválida." });
    const b = assinarBody.safeParse(req.body);
    if (!b.success) {
      return reply.code(400).send({ error: b.error.issues[0]?.message ?? "Pedido inválido.", campos: b.error.issues.map(i => ({ campo: i.path.join("."), erro: i.message })) });
    }
    try {
      return await publico.assinar(db, p.data.token, b.data, meta(req));
    } catch (err) {
      return falha(reply, err);
    }
  });

  app.post("/v1/public/assinar/:token/recusar", LIMITE(5), async (req, reply) => {
    const p = comToken(req);
    if (!p.success) return reply.code(404).send({ error: "Ligação inválida." });
    const b = z.object({ motivo: z.string().trim().max(500).default("") }).safeParse(req.body ?? {});
    if (!b.success) return reply.code(400).send({ error: "Pedido inválido." });
    try {
      return await publico.recusar(db, p.data.token, b.data.motivo, meta(req));
    } catch (err) {
      return falha(reply, err);
    }
  });

  app.post("/v1/public/assinar/:token/externo", LIMITE(5), async (req, reply) => {
    const p = comToken(req);
    if (!p.success) return reply.code(404).send({ error: "Ligação inválida." });
    let bytes: Buffer | null = null;
    try {
      for await (const part of req.parts()) {
        if (part.type === "file") bytes = await part.toBuffer();
      }
    } catch {
      return reply.code(400).send({ error: "Upload inválido ou demasiado grande." });
    }
    if (!bytes?.length) return reply.code(400).send({ error: "Escolha o PDF assinado." });
    try {
      return await publico.receberAssinadoExterno(db, p.data.token, bytes, meta(req));
    } catch (err) {
      return falha(reply, err);
    }
  });

  app.get("/v1/public/verificar/:codigo", LIMITE(20), async (req, reply) => {
    const p = codigoParam.safeParse(req.params);
    if (!p.success) return reply.code(404).send({ error: "Código inválido." });
    try {
      return await publico.verificar(db, p.data.codigo);
    } catch (err) {
      return falha(reply, err);
    }
  });
}
