import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { atualizarPerfil, gerarAcessoFormando, montarArea, pedirRecuperacao, perfilSchema, reporPalavraPasse, sugestoesDeCursos } from "../areaFormando.js";
import { assertFormandoDoUser, uploadDocFormandoFin, vistaDocumentosFormandoFin } from "../formandoFinDocs.js";
import { enviarEmailAcesso } from "../inscricaoPaga.js";
import { pode } from "../permissoes/capacidades.js";
import { nomeDoFormando } from "../repos/formandosInscricao.js";
import { idNum, regimeIdParam, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

/** Área do formando (o próprio formando) e acesso gerado pela secretaria. */
export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  function soFormando(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply, { formando: true })) return false;
    if (req.actor!.role !== "formando") {
      reply.code(403).send({ error: "a área do formando não abre o GesForma" });
      return false;
    }
    return true;
  }

  app.get("/v1/area-formando", async (req, reply) => {
    if (!soFormando(req, reply)) return;
    return montarArea(db, req.actor!);
  });

  /** Cursos sugeridos ao formando (mostram-se depois de deixar a sua opinião). */
  app.get("/v1/area-formando/sugestoes", async (req, reply) => {
    if (!soFormando(req, reply)) return;
    return { cursos: await sugestoesDeCursos(db, req.actor!.id) };
  });

  app.patch("/v1/area-formando", async (req, reply) => {
    if (!soFormando(req, reply)) return;
    const v = validar(reply, { body: perfilSchema }, req);
    if (!v) return;
    return atualizarPerfil(db, req.actor!, v.body);
  });

  app.post("/v1/formandos/:regime/:id/acesso", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, {
      params: regimeIdParam,
      body: z.object({ repor: z.boolean().optional(), enviarEmail: z.boolean().optional() }).default({}),
    }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const role = req.actor!.role;
    // A palavra-passe gerada é mostrada: só a secretaria (Gold) e a pedagogia (Financiada).
    if (!pode(role, regime === "fin" ? "formandosFin.gerir" : "pagamentos.confirmar")) {
      return reply.code(403).send({ error: "Só a secretaria gera o acesso do formando." });
    }
    const repor = Boolean(v.body.repor);
    const resultado = await gerarAcessoFormando(db, regime, id, repor);
    if ("erro" in resultado) return reply.code(resultado.estado).send({ error: resultado.erro });
    // Opcional: o utilizador (email) e a palavra-passe temporária seguem por email para a pessoa.
    let emailEnviado = false;
    if (v.body.enviarEmail) {
      const f = await nomeDoFormando(db, regime, id);
      const nome = `${f?.nome ?? ""} ${f?.apelido ?? ""}`.trim() || resultado.email;
      emailEnviado = await enviarEmailAcesso(db, {
        email: resultado.email, nome, curso: String(f?.curso ?? ""), password: resultado.password, pago: false,
      }).then(() => true, () => false);
    }
    await audit(db, req.actor!.id, repor ? "formando.acesso_reposto" : "formando.acesso", regime === "gold" ? "formandos_gold" : "formandos_fin", String(id), req.ip, {
      criado: resultado.criado, emailEnviado,
    });
    return { acesso: { ...resultado, emailEnviado } };
  });

  app.get("/v1/area-formando/documentos/:formandoId", async (req, reply) => {
    if (!soFormando(req, reply)) return;
    const v = validar(reply, { params: z.object({ formandoId: idNum }) }, req);
    if (!v) return;
    if (!await assertFormandoDoUser(db, req.actor!.id, v.params.formandoId)) {
      return reply.code(403).send({ error: "sem acesso a esta ficha" });
    }
    const vista = await vistaDocumentosFormandoFin(db, v.params.formandoId);
    if (!vista) return reply.code(404).send({ error: "inexistente" });
    return vista;
  });

  app.post("/v1/area-formando/documentos/:formandoId", async (req, reply) => {
    if (!soFormando(req, reply)) return;
    const v = validar(reply, { params: z.object({ formandoId: idNum }) }, req);
    if (!v) return;
    const formandoId = v.params.formandoId;
    if (!await assertFormandoDoUser(db, req.actor!.id, formandoId)) {
      return reply.code(403).send({ error: "sem acesso a esta ficha" });
    }
    let name = "ficheiro";
    let mime = "application/octet-stream";
    let bytes: Buffer | null = null;
    let tipo = "";
    try {
      for await (const part of req.parts()) {
        if (part.type === "file") {
          name = part.filename || name;
          mime = part.mimetype || mime;
          bytes = await part.toBuffer();
        } else if (part.fieldname === "tipo") tipo = String(part.value ?? "").slice(0, 40);
      }
    } catch {
      return reply.code(400).send({ error: "upload inválido" });
    }
    if (!bytes || !tipo) return reply.code(400).send({ error: "pedido inválido" });
    const up = await uploadDocFormandoFin(db, formandoId, tipo, { name, mime, bytes }, { actorId: req.actor!.id, viaFormando: true });
    if ("error" in up) return reply.code(400).send({ error: up.error });
    return up;
  });

  app.post("/v1/auth/recuperar", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (req, reply) => {
    const v = validar(reply, { body: z.object({ email: z.string().max(254) }) }, req);
    if (!v) return;
    await pedirRecuperacao(db, v.body.email, req.ip);
    return reply.send({ ok: true });
  });

  app.post("/v1/auth/repor", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (req, reply) => {
    const v = validar(reply, { body: z.object({ token: z.string().min(10).max(200), password: z.string().min(1).max(200) }) }, req);
    if (!v) return;
    const r = await reporPalavraPasse(db, v.body.token, v.body.password);
    if ("erro" in r) return reply.code(400).send({ error: r.erro });
    return r;
  });
}
