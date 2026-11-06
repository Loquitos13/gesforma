/**
 * Ficha da pré-inscrição, parte da secretaria: validar/recusar documentos (a recusa avisa logo a pessoa),
 * reenviar o pedido dos documentos, alertas de documentos novos,
 * validar a pré-inscrição, pedir o pagamento, nova ligação pessoal e sugestão por turma cheia.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { somarPorPerfil } from "../permissoes/personalizado.js";
import { z } from "zod";
import { getLeadDossier, logLeadEvent } from "../crmDossier.js";
import { staffValida } from "../crmLeadsServico.js";
import { avisarComprovativoRecusado, avisarRecusasLead, reenviarPedidoLead } from "../avisosDocumentos.js";
import { abrirAlerta, definirEstadoDoc, dispensarAlerta, documentosUrl, ensureDocsToken, firePreinscricaoEmail, listarAlertasAbertas, listarDocsLead, syncLigacao } from "../docsLink.js";
import { enviarModelo } from "../emailModelo.js";
import { isEmail, normalizeEmail } from "../security.js";
import { guardarDocDaPreinscricao, tiposDoLead } from "../docsPreinscricao.js";
import { ensurePagamentoPendente } from "../pagamentoPedido.js";
import { eComprovativo, estadoPrestacoes, prestacoesDoLead } from "../docsCurso.js";
import * as pagsLead from "../repos/pagamentosLead.js";
import { ficheiroDeDocumentoDaEquipa } from "../ficheirosValidacao.js";
import { linhaVisivel } from "../repos/crmVisivel.js";
import { concluirInscricaoPaga } from "../inscricaoPaga.js";
import { regenerarToken } from "../ligacaoPessoal.js";
import { confirmarPagamento } from "../ops.js";
import { PedidoPagamentoErro, pedirPagamento } from "../pagamentoPedido.js";
import { PercursoErro, enviarSugestaoTurmaCheia, validarPreinscricao } from "../percurso.js";
import { pode } from "../permissoes/capacidades.js";
import * as dossie from "../repos/leadDossier.js";
import * as docs from "../repos/leadDocs.js";
import * as leads from "../repos/leads.js";
import { idParam, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const docParams = idParam.extend({ docId: z.coerce.number().int().positive() });

/**
 * Quem valida ou recusa: o comprovativo de pagamento, a equipa (comercial e coordenações incluídos) e a contabilidade;
 * os outros documentos, a coordenação. Validar o comprovativo confirma o pagamento e conclui a inscrição.
 */
function podeDecidir(role: string, tipo: string | null) {
  return pode(role, eComprovativo(tipo) ? "pagamentos.validarComprovativo" : "crm.validarDocumentos");
}
const SEM_PERMISSAO = "Sem permissão para validar este documento.";

export async function registarDocumentosCrm(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.get("/v1/alertas/documentos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const alertas = await somarPorPerfil(req, a => listarAlertasAbertas(db, a), a => a.id);
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

  // Pagamento em prestações: a comercial ou a coordenação confirma em quantas vezes e o valor de cada uma (1x por
  // omissão), ao anexar o primeiro comprovativo; pode corrigir depois, sem tirar prestações que já têm comprovativo.
  app.put("/v1/crm/leads/:id/prestacoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: z.object({ valores: z.array(z.number().positive().max(100_000)).min(1).max(12) }) }, req);
    if (!v) return;
    const { id } = v.params;
    const lead = await leads.lead(db, id);
    if (!lead || !(await linhaVisivel(db, "preinscricoes", id, req.actor!))) return reply.code(404).send({ error: "pré-inscrição inexistente" });
    if (String(lead.regime ?? "gold") === "fin") return reply.code(400).send({ error: "A Formação Financiada não tem pagamento." });
    const valores = v.body.valores.map(x => Math.round(x * 100) / 100);
    const comComprovativo = (await docs.docsDoLead(db, id)).filter(d => eComprovativo(d.tipo) && d.estado !== "recusado")
      .map(d => (d.tipo === "comprovativo" ? 1 : Number(d.tipo.split("-")[1])));
    if (comComprovativo.some(n => n > valores.length)) {
      return reply.code(409).send({ error: `A prestação ${Math.max(...comComprovativo)} já tem comprovativo: não pode ficar com menos prestações.` });
    }
    await db.query("UPDATE preinscricoes SET prestacoes = $2::jsonb WHERE id = $1", [id, JSON.stringify(valores)]);
    const total = valores.reduce((a, b) => a + b, 0);
    const fmt = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
    await logLeadEvent(db, id, req.actor!.id, "seguimento", valores.length === 1 ? "Pagamento de uma vez" : `Pagamento em ${valores.length} prestações`,
      `${valores.map(fmt).join(" + ")} = ${fmt(total)}`);
    await audit(db, req.actor!.id, "crm.prestacoes", "preinscricao", String(id), req.ip, { valores });
    return getLeadDossier(db, id, req.actor!);
  });

  // Lembrete à pessoa para pagar a prestação seguinte (só à mão, na ficha): a ligação pessoal abre no passo do pagamento.
  app.post("/v1/crm/leads/:id/lembrete-prestacao", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const { id } = v.params;
    const lead = await leads.lead(db, id);
    if (!lead || !(await linhaVisivel(db, "preinscricoes", id, req.actor!))) return reply.code(404).send({ error: "pré-inscrição inexistente" });
    const prest = estadoPrestacoes(lead as Record<string, unknown>, await listarDocsLead(db, id));
    const proxima = prest.find(p => p.estado === "em_falta" || p.estado === "recusado");
    if (!proxima) return reply.code(409).send({ error: "Não há prestações à espera de comprovativo." });
    const email = normalizeEmail(String(lead.email ?? ""));
    if (!isEmail(email)) return reply.code(400).send({ error: "A pré-inscrição não tem um email válido." });
    const link = `${documentosUrl(await ensureDocsToken(db, id))}?passo=pagamento`;
    const valor = proxima.valor.toFixed(2).replace(".", ",");
    const prestacao = `${proxima.n}.ª`;
    await enviarModelo(db, {
      tipo: "lembrete_prestacao", area: "gold", para: email, nome: `${lead.nome ?? ""} ${lead.apelido ?? ""}`.trim(), link,
      vars: { curso: String(lead.curso ?? ""), valor, prestacao, total_prestacoes: String(prest.length), comprovativo_url: link },
      reserva: {
        assunto: "Pagamento da {{prestacao}} prestação · {{curso}}",
        linhas: [
          "Lembramos que está na altura de pagar a {{prestacao}} prestação (de {{total_prestacoes}}) da sua inscrição em {{curso}}: € {{valor}}.",
          "Depois de fazer a transferência, anexe o comprovativo na sua página de pagamento.",
        ],
        cta: "Anexar o comprovativo",
      },
    });
    await logLeadEvent(db, id, req.actor!.id, "seguimento", `Lembrete da prestação ${proxima.n}`, `€ ${valor} · enviado para ${email}`);
    await audit(db, req.actor!.id, "crm.lembrete_prestacao", "preinscricao", String(id), req.ip, { n: proxima.n });
    return getLeadDossier(db, id, req.actor!);
  });

  // A equipa (coordenação e comerciais) entrega um documento pela pessoa (não conseguiu ou não sabe): fica como se ela o
  // tivesse enviado na ligação pessoal (pasta na Drive, por rever pela coordenação; o comprovativo segue para a contabilidade).
  app.post("/v1/crm/leads/:id/documentos/entregar/:tipo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam.extend({ tipo: z.string().trim().min(1).max(60) }) }, req);
    if (!v) return;
    const { id, tipo } = v.params;
    const lead = await leads.lead(db, id);
    if (!lead || !(await linhaVisivel(db, "preinscricoes", id, req.actor!))) return reply.code(404).send({ error: "pré-inscrição inexistente" });
    let up: { name: string; mime: string; bytes: Buffer } | null = null;
    try {
      for await (const part of req.parts()) {
        if (part.type === "file") up = { name: part.filename || "documento", mime: part.mimetype || "application/octet-stream", bytes: await part.toBuffer() };
      }
    } catch {
      return reply.code(400).send({ error: "upload inválido" });
    }
    if (!up?.bytes.length) return reply.code(400).send({ error: "Escolha o ficheiro do documento." });
    const ficheiro = ficheiroDeDocumentoDaEquipa(up.name, up.bytes);
    if ("erro" in ficheiro) return reply.code(400).send({ error: ficheiro.erro });
    const { tipos, pedidos, ja } = await tiposDoLead(db, lead as Record<string, unknown>);
    const doc = tipos.find(t => t.id === tipo);
    if (!doc) return reply.code(400).send({ error: "Este documento não faz parte do curso desta pré-inscrição." });
    if (doc.validado) return reply.code(409).send({ error: "Este documento já está validado." });
    // Comprovativo: em quantas vezes é o pagamento tem de estar confirmado pela equipa (1x por omissão, no ecrã).
    if (eComprovativo(tipo) && !prestacoesDoLead(lead as Record<string, unknown>).length) {
      return reply.code(409).send({ error: "Confirme primeiro em quantas vezes é o pagamento." });
    }
    const por = req.actor!.name || req.actor!.email || "Equipa";
    // Comprovativo sem o pagamento pedido (documentos todos validados): o pagamento fica registado como pendente, como
    // se tivesse sido pedido, mas sem email à pessoa.
    if (tipo === "comprovativo" && (!lead.pagamento_pedido_em || !lead.pagamento_id)) {
      const pag = await ensurePagamentoPendente(db, { ...(lead as never as Parameters<typeof ensurePagamentoPendente>[1]), preco: Number(lead.preco) || 0 });
      if (!lead.pagamento_pedido_em) {
        await pagsLead.definirMetodoPendente(db, String(pag.id), "Transferência bancária");
        await pagsLead.marcarPagamentoPedido(db, id);
      }
    }
    let guardado: { id: string; name: string };
    try {
      guardado = await guardarDocDaPreinscricao(db, (await leads.lead(db, id)) as Record<string, unknown>, tipo, { ...up, name: ficheiro.nome, mime: ficheiro.mime }, {
        pedidos, ja, actorId: req.actor!.id, origem: `entregue pela equipa, por ${por}`,
      });
    } catch (err) {
      req.log.warn({ err }, "documento da pré-inscrição não guardado");
      return reply.code(502).send({ error: "Não foi possível guardar o documento (Drive). Tente outra vez." });
    }
    // Documento do curso entregue pela coordenação (quem os valida): fica logo validado. O do comercial fica por validar.
    if (!eComprovativo(tipo) && pode(req.actor!.role, "crm.validarDocumentos")) {
      const doc = (await docs.docsDoLead(db, id)).find(d => d.tipo === tipo && d.drive_file_id === guardado.id);
      if (doc) await definirEstadoDoc(db, id, doc.id, "validado", "", req.actor!.id);
    }
    await syncLigacao(db, id);
    await abrirAlerta(db, id);
    await audit(db, req.actor!.id, "crm.doc_entregue_equipa", "preinscricao", String(id), req.ip, { tipo });
    return getLeadDossier(db, id, req.actor!);
  });

  app.post("/v1/crm/leads/:id/documentos/:docId/validar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: docParams }, req);
    if (!v) return;
    const { id, docId } = v.params;
    const doc = await docs.tipoEstadoDoDoc(db, docId);
    if (!podeDecidir(req.actor!.role, doc?.tipo ?? null)) return reply.code(403).send({ error: SEM_PERMISSAO });
    // Já validado (outra pessoa validou ao mesmo tempo): fica como está, sem erro nem efeitos repetidos.
    if (doc?.estado === "validado") return getLeadDossier(db, id, req.actor!);
    const ok = await definirEstadoDoc(db, id, docId, "validado", "", req.actor!.id);
    if (!ok) return reply.code(404).send({ error: "documento inexistente" });
    await logLeadEvent(db, id, req.actor!.id, "campo", "Documento validado", String(docId));
    // Comprovativo aceite = pagamento recebido: confirma o pagamento ligado à pré-inscrição.
    const tipoValidado = await docs.tipoDoDoc(db, docId);
    if (tipoValidado && tipoValidado !== "comprovativo" && eComprovativo(tipoValidado)) {
      await logLeadEvent(db, id, req.actor!.id, "seguimento", `Prestação ${tipoValidado.split("-")[1]} paga`, "Comprovativo validado na ficha da pré-inscrição.");
    }
    if (tipoValidado === "comprovativo") {
      const lead = await leads.lead(db, id);
      const pag = lead?.pagamento_id ? await dossie.pagamento(db, String(lead.pagamento_id)) : null;
      // Só um pagamento pendente: um cancelado ou reembolsado nunca volta a «Pago».
      if (pag && String(pag.estado ?? "") === "Pendente") {
        await confirmarPagamento(db, pag, null, { soPendente: true });
        await audit(db, req.actor!.id, "pagamento.confirmado_comprovativo", "pagamento", String(pag.id), req.ip, { preinscricao: id });
        await logLeadEvent(db, id, req.actor!.id, "seguimento", "Pagamento confirmado", "Comprovativo validado na ficha da pré-inscrição.");
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
    const doc = await docs.tipoEstadoDoDoc(db, docId);
    if (!podeDecidir(req.actor!.role, doc?.tipo ?? null)) return reply.code(403).send({ error: SEM_PERMISSAO });
    if (doc?.estado === "validado" && eComprovativo(doc.tipo)) {
      return reply.code(409).send({ error: "Este comprovativo já foi validado (o pagamento está confirmado)." });
    }
    const ok = await definirEstadoDoc(db, id, docId, "recusado", observacao, req.actor!.id);
    if (!ok) return reply.code(404).send({ error: "documento inexistente" });
    await logLeadEvent(db, id, req.actor!.id, "campo", "Documento recusado", observacao);
    await audit(db, req.actor!.id, "crm.doc_recusado", "preinscricao", String(id), req.ip, { docId });
    // A pessoa recebe logo o pedido de reenvio (recusas seguidas agrupam-se num só email). O comprovativo de pagamento
    // (o 1.º ou o de uma prestação seguinte) tem email próprio, com o motivo e a ligação no passo do pagamento, onde a
    // pessoa anexa outro.
    const aviso = await (doc?.tipo && eComprovativo(doc.tipo)
      ? avisarComprovativoRecusado(db, id, { id: docId, tipo: doc.tipo, observacao }, req.actor!.id)
      : avisarRecusasLead(db, id, { actorId: req.actor!.id })
    ).catch(err => {
      req.log.error({ err }, "aviso da recusa falhou");
      return null;
    });
    const dossie = await getLeadDossier(db, id, req.actor!);
    return dossie && { ...dossie, avisoRecusa: { enviado: Boolean(aviso?.enviado), adiado: Boolean(aviso?.adiado), ...(aviso?.erro ? { erro: aviso.erro } : {}) } };
  });

  /** «Reenviar pedido agora»: documentos recusados (com o motivo) ou em falta, com a ligação pessoal. */
  async function reenviarPedido(req: FastifyRequest, reply: FastifyReply) {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const r = await reenviarPedidoLead(db, v.params.id, req.actor!.id);
    if (!r) return reply.code(404).send({ error: "pré-inscrição inexistente" });
    if (!r.enviado) return reply.code(r.adiado ? 409 : 400).send({ error: r.erro ?? "Não foi possível enviar." });
    await audit(db, req.actor!.id, "crm.doc_pedido_reenviado", "preinscricao", String(v.params.id), req.ip, { documentos: r.documentos ?? [] });
    return { ok: true, documentos: r.documentos ?? [], dossie: await getLeadDossier(db, v.params.id, req.actor!) };
  }
  app.post("/v1/crm/leads/:id/documentos/reenviar-pedido", reenviarPedido);
  // Nome antigo (email dos documentos a corrigir): o mesmo pedido.
  app.post("/v1/crm/leads/:id/documentos/alertar", reenviarPedido);

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

  /**
   * Inserir na turma a pessoa com o pagamento confirmado (on demand, depois de validado o comprovativo): ficha de
   * formando na turma escolhida, conta e email de acesso. O comercial e a coordenação.
   */
  app.post("/v1/crm/leads/:id/concluir-inscricao", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!pode(req.actor!.role, "crm.inserirNaTurma")) return reply.code(403).send({ error: "Só o comercial, a coordenação ou a administração inserem na turma." });
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

  /**
   * Envia à pessoa, por email, a ligação pessoal atual (sem a trocar), com a turma escolhida agora: para quando faz uma
   * pré-inscrição repetida ou não encontra o email. Uma ligação já expirada é renovada.
   */
  app.post("/v1/crm/leads/:id/enviar-ligacao", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const id = v.params.id;
    const lead = await leads.lead(db, id);
    if (!lead) return reply.code(404).send({ error: "pré-inscrição inexistente" });
    if (lead.validada_em || lead.estado === "Formando") {
      return reply.code(409).send({ error: "A pré-inscrição já foi validada: a ligação pessoal fica encerrada." });
    }
    const { fechoDaLigacao } = await import("../ligacaoPessoal.js");
    if (await fechoDaLigacao(db, lead) === "expirada") await regenerarToken(db, id);
    const dados = lead as { id: number; nome: string; apelido: string; email: string; curso: string; regime?: string };
    const mail = await firePreinscricaoEmail(db, dados, "preinscricao.created", `enviar-ligacao:${id}:${Date.now()}`).catch(() => null);
    if (!mail?.queued) return reply.code(409).send({ error: "O email não saiu: confirme o email da pessoa e se a regra da pré-inscrição está ativa (Sistema › Emails)." });
    await leads.inserirContacto(db, { leadId: id, actorId: req.actor!.id, nota: `Ligação pessoal enviada por email: ${mail.url}`, meio: "Email" });
    await logLeadEvent(db, id, req.actor!.id, "contacto", "Ligação pessoal enviada por email", String(lead.curso ?? ""));
    await audit(db, req.actor!.id, "preinscricao.enviar_ligacao", "preinscricao", String(id), req.ip);
    return { ok: true, url: mail.url ?? null };
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
    if (!pode(req.actor!.role, "crm.sugerirTurma")) return reply.code(403).send({ error: "Só o comercial, a coordenação ou a administração enviam esta sugestão." });
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
