/** Dossiê da turma: estado manual dos itens, anexos e PDFs gerados. */
import type { FastifyInstance } from "fastify";
import { eItemDossieGerado, pdfDossieGerado } from "../../dossieGerado.js";
import { dtpForTurma } from "../../pedagogia/dtp.js";
import { anexoSchema, dtpSchema, itemParam } from "../../pedagogia/esquemas.js";
import { anexarPdfDtp, gravarPdfsDossie } from "../../pedagogia/ficheiros.js";
import { definirEstadoManual, gravarAnexo, limparEstadoManual } from "../../repos/dtp.js";
import { carregarTurma } from "../../repos/pedagogiaTurma.js";
import { regimeIdParam, validar } from "../../validacao.js";
import type { Deps } from "../tipos.js";
import { enviarPdf, semFormador, turmaOu404 } from "./comum.js";

const SEM_FORMADOR = "O formador não altera o dossiê técnico-pedagógico.";

export function registarDossieTurma(app: FastifyInstance, { db, requireAuth, audit }: Deps) {
  app.put("/v1/turmas/:regime/:id/dtp/:itemId", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, SEM_FORMADOR)) return;
    const v = validar(reply, { params: itemParam, body: dtpSchema }, req);
    if (!v) return;
    const { regime, id, itemId } = v.params;
    const turma = await turmaOu404(db, reply, regime, id);
    if (!turma) return;
    if (v.body.estado === "auto") await limparEstadoManual(db, regime, id, itemId);
    else await definirEstadoManual(db, regime, id, itemId, v.body.estado);
    await audit(db, req.actor!.id, "turma.dtp", "turma", String(id), req.ip, { regime, item: itemId, estado: v.body.estado });
    return { dtp: await dtpForTurma(db, regime, turma) };
  });

  app.put("/v1/turmas/:regime/:id/dtp/:itemId/anexo", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, SEM_FORMADOR)) return;
    const v = validar(reply, { params: itemParam, body: anexoSchema }, req);
    if (!v) return;
    const { regime, id, itemId } = v.params;
    const turma = await turmaOu404(db, reply, regime, id);
    if (!turma) return;
    await gravarAnexo(db, regime, id, itemId, { id: v.body.driveFileId, nome: v.body.fileName, url: v.body.driveUrl ?? "" });
    await definirEstadoManual(db, regime, id, itemId, "ok");
    await audit(db, req.actor!.id, "turma.dtp_anexo", "turma", String(id), req.ip, { regime, item: itemId });
    return { dtp: await dtpForTurma(db, regime, turma) };
  });

  app.post("/v1/turmas/:regime/:id/dtp/pdfs", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const turma = await turmaOu404(db, reply, regime, id);
    if (!turma) return;
    try {
      await gravarPdfsDossie(db, req.actor!.id, regime, turma);
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "não foi possível gravar os PDFs" });
    }
    await audit(db, req.actor!.id, "turma.dtp_pdfs", "turma", String(id), req.ip, { regime });
    return { ok: true, dtp: await dtpForTurma(db, regime, turma) };
  });

  app.get("/v1/turmas/:regime/:id/dossie/:itemId", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, "O formador não gera o dossiê da turma.")) return;
    const v = validar(reply, { params: itemParam }, req);
    if (!v) return;
    const { regime, id, itemId } = v.params;
    if (regime !== "fin" || !eItemDossieGerado(itemId)) return reply.code(400).send({ error: "Este PDF é da turma financiada." });
    const gerado = await pdfDossieGerado(db, id, itemId);
    if (!gerado) return reply.code(404).send({ error: "turma não encontrada" });
    const turma = await carregarTurma(db, "fin", id);
    if (turma) await anexarPdfDtp(db, req.actor!.id, "fin", turma, itemId, gerado.nome, gerado.bytes).catch(() => undefined);
    await audit(db, req.actor!.id, "turma.dossie_pdf", "turma", String(id), req.ip, { item: itemId });
    return enviarPdf(reply, gerado.nome, gerado.bytes);
  });
}
