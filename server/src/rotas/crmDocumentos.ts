/**
 * Ficha da pré-inscrição, parte da secretaria: validar/recusar documentos, alertas de documentos novos,
 * validar a pré-inscrição, pedir o pagamento, nova ligação pessoal e sugestão por turma cheia.
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getLeadDossier, logLeadEvent } from "../crmDossier.js";
import { staffValida } from "../crmLeadsServico.js";
import { alertarDocumentosIncorrectos, definirEstadoDoc, dispensarAlerta, firePreinscricaoEmail, listarAlertasAbertas } from "../docsLink.js";
import { concluirInscricaoPaga } from "../inscricaoPaga.js";
import { regenerarToken } from "../ligacaoPessoal.js";
import { confirmarPagamento } from "../ops.js";
import { PedidoPagamentoErro, pedirPagamento } from "../pagamentoPedido.js";
import { PercursoErro, enviarSugestaoTurmaCheia, validarPreinscricao } from "../percurso.js";
import * as dossie from "../repos/leadDossier.js";
import * as docs from "../repos/leadDocs.js";
import * as leads from "../repos/leads.js";
import { idParam, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const docParams = idParam.extend({ docId: z.coerce.number().int().positive() });

export async function registarDocumentosCrm(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.get("/v1/alertas/documentos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const alertas = await listarAlertasAbertas(db, req.actor!);
    return {
      alertas: alertas.map(a => ({
        id: a.id,
        preinscricaoId: a.preinscricao_id,
        nome: a.nome,
        apelido: a.apelido,
        curso: a.curso,
        regime: a.regime === "fin" ? "fin" : "gold",
        createdAt: a.created_at,
      })),
    };
  });

  app.post("/v1/alertas/documentos/:id/dispensar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: z.object({ id: z.string().trim().min(1).max(64) }) }, req);
    if (!v) return;
    await dispensarAlerta(db, v.params.id, req.actor!);
    return { ok: true };
  });

  app.post("/v1/crm/leads/:id/documentos/:docId/validar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: docParams }, req);
    if (!v) return;
    const { id, docId } = v.params;
    const ok = await definirEstadoDoc(db, id, docId, "validado", "", req.actor!.id);
    if (!ok) return reply.code(404).send({ error: "documento inexistente" });
    await logLeadEvent(db, id, req.actor!.id, "campo", "Documento validado", String(docId));
    // Comprovativo aceite = pagamento recebido: confirma o pagamento ligado à pré-inscrição.
    if ((await docs.tipoDoDoc(db, docId)) === "comprovativo") {
      const lead = await leads.lead(db, id);
      const pag = lead?.pagamento_id ? await dossie.pagamento(db, String(lead.pagamento_id)) : null;
      if (pag && !/^pago$/i.test(String(pag.estado ?? ""))) {
        await confirmarPagamento(db, pag);
        await audit(db, req.actor!.id, "pagamento.confirmado_comprovativo", "pagamento", String(pag.id), req.ip, { preinscricao: id });
        await logLeadEvent(db, id, req.actor!.id, "seguimento", "Pagamento confirmado", "Comprovativo validado pela secretaria.");
      }
    }
    await audit(db, req.actor!.id, "crm.doc_validado", "preinscricao", String(id), req.ip, { docId });
    return getLeadDossier(db, id, req.actor!);
  });

  app.post("/v1/crm/leads/:id/documentos/:docId/recusar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, {
      params: docParams,
      body: z.object({ observacao: z.string().trim().max(500).optional().default("") }).optional(),
    }, req);
    if (!v) return;
    const { id, docId } = v.params;
    const observacao = v.body?.observacao ?? "";
    if (!observacao) return reply.code(400).send({ error: "Escreva o que está incorrecto." });
    const ok = await definirEstadoDoc(db, id, docId, "recusado", observacao, req.actor!.id);
    if (!ok) return reply.code(404).send({ error: "documento inexistente" });
    await logLeadEvent(db, id, req.actor!.id, "campo", "Documento recusado", observacao);
    await audit(db, req.actor!.id, "crm.doc_recusado", "preinscricao", String(id), req.ip, { docId });
    return getLeadDossier(db, id, req.actor!);
  });

  app.post("/v1/crm/leads/:id/documentos/alertar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const r = await alertarDocumentosIncorrectos(db, v.params.id);
    if (!r) return reply.code(404).send({ error: "pré-inscrição inexistente" });
    if (!r.enviado) return reply.code(400).send({ error: r.erro });
    await audit(db, req.actor!.id, "crm.doc_alerta_email", "preinscricao", String(v.params.id), req.ip);
    return { ok: true };
  });

  app.post("/v1/crm/leads/:id/validar-preinscricao", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!staffValida(req.actor?.role)) return reply.code(403).send({ error: "Só a equipa pedagógica ou administração valida a pré-inscrição." });
    const v = validar(reply, {
      params: idParam,
      body: z.object({ turmaId: z.number().int().positive().optional() }).optional(),
    }, req);
    if (!v) return;
    try {
      await validarPreinscricao(db, v.params.id, req.actor!.id, v.body?.turmaId);
    } catch (err) {
      if (!(err instanceof PercursoErro)) req.log.error({ err }, "validar pré-inscrição falhou");
      return reply.code(400).send({ error: err instanceof PercursoErro ? err.message : "Não foi possível validar." });
    }
    await audit(db, req.actor!.id, "preinscricao.validar", "preinscricao", String(v.params.id), req.ip, { turmaId: v.body?.turmaId ?? null });
    return getLeadDossier(db, v.params.id, req.actor!);
  });

  app.post("/v1/crm/leads/:id/pedir-pagamento", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!staffValida(req.actor?.role)) return reply.code(403).send({ error: "Só a equipa pedagógica ou administração pede o pagamento." });
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    try {
      const r = await pedirPagamento(db, v.params.id, req.actor!.id);
      await audit(db, req.actor!.id, "preinscricao.pagamento_pedido", "preinscricao", String(v.params.id), req.ip, { valor: r.valor });
      return { ...(await getLeadDossier(db, v.params.id, req.actor!)), pedido: r };
    } catch (err) {
      if (err instanceof PedidoPagamentoErro) return reply.code(409).send({ error: err.message });
      throw err;
    }
  });

  /** Volta a concluir a inscrição Gold paga que ficou a meio: ficha na turma, conta e email de acesso. */
  app.post("/v1/crm/leads/:id/concluir-inscricao", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!staffValida(req.actor?.role)) return reply.code(403).send({ error: "Só a equipa pedagógica ou administração conclui a inscrição." });
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    try {
      const r = await concluirInscricaoPaga(db, v.params.id, req.actor!.id);
      await audit(db, req.actor!.id, "preinscricao.concluir_inscricao", "preinscricao", String(v.params.id), req.ip, { formandoId: r.formandoId });
      return getLeadDossier(db, v.params.id, req.actor!);
    } catch (err) {
      if (err instanceof PercursoErro) return reply.code(409).send({ error: err.message });
      throw err;
    }
  });

  app.post("/v1/crm/leads/:id/nova-ligacao", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const id = v.params.id;
    const lead = await leads.lead(db, id);
    if (!lead) return reply.code(404).send({ error: "pré-inscrição inexistente" });
    if (lead.validada_em || lead.estado === "Formando") {
      return reply.code(409).send({ error: "A pré-inscrição já foi validada: a ligação pessoal fica encerrada." });
    }
    await regenerarToken(db, id);
    // Chave nova a cada pedido (como o reenvio do site): com a chave fixa só o primeiro email saía.
    const dados = lead as { id: number; nome: string; apelido: string; email: string; curso: string; regime?: string };
    const mail = await firePreinscricaoEmail(db, dados, "preinscricao.created", `nova-ligacao:${id}:${Date.now()}`).catch(() => null);
    if (mail?.queued) await leads.inserirContacto(db, { leadId: id, actorId: req.actor!.id, nota: `Nova ligação pessoal enviada: ${mail.url}`, meio: "Email" });
    await logLeadEvent(db, id, req.actor!.id, "contacto", "Nova ligação pessoal", "A ligação anterior deixou de funcionar.");
    await audit(db, req.actor!.id, "preinscricao.nova_ligacao", "preinscricao", String(id), req.ip);
    return { ok: true, url: mail?.url ?? null };
  });

  app.post("/v1/crm/leads/:id/turma-cheia", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!staffValida(req.actor?.role)) return reply.code(403).send({ error: "Só a equipa pedagógica ou administração envia esta sugestão." });
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    try {
      const r = await enviarSugestaoTurmaCheia(db, v.params.id, req.actor!.id);
      await audit(db, req.actor!.id, "preinscricao.turma_cheia", "preinscricao", String(v.params.id), req.ip, { enviadas: r.enviadas });
      return { ok: true, enviadas: r.enviadas, turmas: r.turmas.map(t => ({ nome: t.nome, horario: t.horario, local: t.local, dataInicio: t.dataInicio, livres: t.livres })) };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof PercursoErro ? err.message : "Não foi possível enviar o email." });
    }
  });
}
