/** Dossiê da turma: estado manual dos itens, anexos e PDFs gerados. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eItemDossieGerado, itensDoMesmoPdf, pdfDossieGerado } from "../../dossieGerado.js";
import { dtpForTurma, estruturaDoDossie } from "../../pedagogia/dtp.js";
import { anexoSchema, dtpSchema, itemParam } from "../../pedagogia/esquemas.js";
import { anexarPdfDtp, gravarPdfsDossie } from "../../pedagogia/ficheiros.js";
import { anexoEmUso, anexosDaTurma, definirEstadoManual, gravarAnexo, limparEstadoManual } from "../../repos/dtp.js";
import { ficheiroDrive } from "../../repos/drive.js";
import { apagarFicheiroSubstituido } from "../../driveFicheiros.js";
import { carregarTurma, type TurmaRow } from "../../repos/pedagogiaTurma.js";
import { ERRO_TURMA_FECHADA, turmaFechada } from "../../resultados.js";
import type { Regime } from "../../pedagogia/util.js";
import { regimeIdParam, validar } from "../../validacao.js";
import type { Deps } from "../tipos.js";
import { enviarPdf, semFormador, turmaOu404 } from "./comum.js";

const SEM_FORMADOR = "O formador não altera o dossiê técnico-pedagógico.";

/** Turma fechada: só o administrador mexe no dossiê. */
async function fechadaParaOActor(db: Deps["db"], req: FastifyRequest, reply: FastifyReply, regime: Regime, id: number) {
  if (req.actor!.role === "admin" || !(await turmaFechada(db, regime, id))) return false;
  reply.code(409).send({ error: ERRO_TURMA_FECHADA });
  return true;
}

/** O item tem de existir no dossiê desta turma (null já respondeu 400). */
async function itemDoDossie(db: Deps["db"], reply: FastifyReply, regime: Regime, turma: TurmaRow, itemId: string) {
  const def = (await estruturaDoDossie(db, regime, turma)).find(d => d.id === itemId);
  if (!def) reply.code(400).send({ error: "Este documento não faz parte do dossiê da turma." });
  return def ?? null;
}

export function registarDossieTurma(app: FastifyInstance, { db, requireAuth, audit }: Deps) {
  app.put("/v1/turmas/:regime/:id/dtp/:itemId", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, SEM_FORMADOR)) return;
    const v = validar(reply, { params: itemParam, body: dtpSchema }, req);
    if (!v) return;
    const { regime, id, itemId } = v.params;
    const turma = await turmaOu404(db, reply, regime, id);
    if (!turma || await fechadaParaOActor(db, req, reply, regime, id) || !(await itemDoDossie(db, reply, regime, turma, itemId))) return;
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
    if (!turma || await fechadaParaOActor(db, req, reply, regime, id)) return;
    const def = await itemDoDossie(db, reply, regime, turma, itemId);
    if (!def) return;
    const anterior = (await anexosDaTurma(db, regime, id)).find(a => a.item_id === itemId)?.drive_file_id ?? "";
    await gravarAnexo(db, regime, id, itemId, { id: v.body.driveFileId, nome: v.body.fileName, url: v.body.driveUrl ?? "" });
    // O anexo substituído (um upload do dossiê que mais nenhum item usa) sai da Drive: não fica uma versão antiga perdida.
    if (anterior && anterior !== v.body.driveFileId) {
      const velho = await ficheiroDrive(db, anterior);
      const emUso = await anexoEmUso(db, anterior);
      if (velho?.kind === "dtp" && !emUso) {
        await apagarFicheiroSubstituido(db, anterior).catch(err => req.log.warn({ err, anterior }, "anexo antigo do dossiê não apagado"));
      }
    }
    // Só um item sem regra automática fica no dossiê pelo anexo; os automáticos continuam a sair dos dados.
    if (!def.auto) await definirEstadoManual(db, regime, id, itemId, "ok");
    await audit(db, req.actor!.id, "turma.dtp_anexo", "turma", String(id), req.ip, { regime, item: itemId });
    return { dtp: await dtpForTurma(db, regime, turma) };
  });

  app.post("/v1/turmas/:regime/:id/dtp/pdfs", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const turma = await turmaOu404(db, reply, regime, id);
    if (!turma || await fechadaParaOActor(db, req, reply, regime, id)) return;
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
    // A folha de presenças e o sumário são o mesmo PDF: guarda-se uma vez (no item das presenças) e liga-se aos dois.
    const [principal = itemId, ...outros] = itensDoMesmoPdf(itemId);
    if (turma) await anexarPdfDtp(db, req.actor!.id, "fin", turma, principal, gerado.nome, gerado.bytes, outros)
      .catch(err => req.log.warn({ err, turma: id, item: itemId }, "PDF não anexado ao dossiê"));
    await audit(db, req.actor!.id, "turma.dossie_pdf", "turma", String(id), req.ip, { item: itemId });
    return enviarPdf(reply, gerado.nome, gerado.bytes);
  });
}
