/** Acções na ficha do formando: documentos, notas e pagamento (Gold). */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { config } from "../../config.js";
import { renderAutomaticEmail } from "../../emailHtml.js";
import { recusarDocFormandoFin, validarDocFormandoFin, vistaDocumentosFormandoFin } from "../../formandoFinDocs.js";
import { sendMail } from "../../mailer.js";
import { nextOpsId } from "../../ops.js";
import { pode } from "../../permissoes/capacidades.js";
import { lerEntidade } from "../../regrasConfig.js";
import { dadosBasicos, garantirPagamentoPendente, registarPagamentoRecebido } from "../../repos/formandosEscrita.js";
import { decidirDoc, docDoFormando, docsDoFormando, gravarDocFicha, inserirNota, notasDoFormando } from "../../repos/formandosDocs.js";
import type { Regime } from "../../repos/sql.js";
import { isEmail, normalizeEmail } from "../../security.js";
import { idNum, regime as regimeEnum, regimeIdParam, validar } from "../../validacao.js";
import type { Deps } from "../tipos.js";
import { carimboUtc, hojeLisboa } from "../../datas.js";

const docParam = z.object({ regime: regimeEnum, id: idNum, docId: z.string().trim().min(1).max(40) });

const docsBody = z.object({
  docs: z.array(z.object({
    id: z.string().trim().min(1).max(40),
    ok: z.boolean(),
    fileName: z.string().max(240).default(""),
    data: z.string().max(40).default(""),
    driveFileId: z.string().max(200).optional(),
    driveUrl: z.string().max(600).optional(),
  })).max(40),
});

function iso(v: unknown) {
  return (v instanceof Date ? v.toISOString() : String(v ?? "")).slice(0, 16).replace("T", " ");
}

function fmtEuros(v: number) {
  return v.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function registarAccoes(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  /** Equipa do regime (o formador e o formando ficam de fora: dados pessoais e pagamentos). */
  function equipa(req: FastifyRequest, reply: FastifyReply, regime: Regime) {
    if (!requireAuth(req, reply)) return false;
    const role = req.actor!.role;
    if (role === "formador" || role === "formando" || !pode(role, regime === "fin" ? "fin.ver" : "gold.ver")) {
      reply.code(403).send({ error: "O formador não consulta documentos, pagamento, notas nem histórico do formando." });
      return false;
    }
    return true;
  }

  app.get("/v1/formandos/:regime/:id/dossier", async (req, reply) => {
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v || !equipa(req, reply, v.params.regime)) return;
    const { regime, id } = v.params;
    const [docs, notas] = await Promise.all([docsDoFormando(db, regime, id), notasDoFormando(db, regime, id)]);
    return {
      docs: docs.map(r => ({
        id: r.doc_id, ok: r.ok, fileName: r.file_name, data: r.data, driveFileId: r.drive_file_id, driveUrl: r.drive_url,
        estado: r.estado, observacao: r.observacao, validadoPor: r.validator_name, validadoEm: r.validated_at ? iso(r.validated_at) : "",
      })),
      notas: notas.map(r => ({ id: Number(r.id), autor: r.autor, texto: r.texto, data: iso(r.created_at) })),
    };
  });

  app.put("/v1/formandos/:regime/:id/docs", async (req, reply) => {
    const v = validar(reply, { params: regimeIdParam, body: docsBody }, req);
    if (!v || !equipa(req, reply, v.params.regime)) return;
    const { regime, id } = v.params;
    for (const doc of v.body.docs) await gravarDocFicha(db, regime, id, doc, req.actor!.id);
    await audit(db, req.actor!.id, "formando.docs", "formando", String(id), req.ip, { regime });
    return { ok: true };
  });

  app.post("/v1/formandos/:regime/:id/notas", async (req, reply) => {
    const v = validar(reply, { params: regimeIdParam, body: z.object({ texto: z.string().trim().min(1).max(4000) }) }, req);
    if (!v || !equipa(req, reply, v.params.regime)) return;
    const { regime, id } = v.params;
    const saved = await inserirNota(db, regime, id, req.actor!.name, req.actor!.id, v.body.texto);
    await audit(db, req.actor!.id, "formando.nota", "formando", String(id), req.ip, { regime });
    return { nota: { id: Number(saved?.id ?? 0), autor: req.actor!.name, texto: v.body.texto, data: iso(saved?.created_at ?? new Date()) } };
  });

  app.get("/v1/formandos/fin/:id/documentos", async (req, reply) => {
    const v = validar(reply, { params: z.object({ id: idNum }) }, req);
    if (!v || !equipa(req, reply, "fin")) return;
    const vista = await vistaDocumentosFormandoFin(db, v.params.id);
    if (!vista) return reply.code(404).send({ error: "formando inexistente" });
    return vista;
  });

  // Validar / recusar um documento enviado (Gold e Financiada).
  app.post("/v1/formandos/:regime/:id/documentos/:docId/validar", async (req, reply) => {
    const v = validar(reply, { params: docParam }, req);
    if (!v || !equipa(req, reply, v.params.regime)) return;
    const { regime, id, docId } = v.params;
    if (regime === "fin") {
      const ok = await validarDocFormandoFin(db, id, docId, req.actor!);
      if (!ok) return reply.code(404).send({ error: "documento inexistente" });
    } else {
      if (!await docDoFormando(db, "gold", id, docId)) return reply.code(404).send({ error: "documento inexistente" });
      await decidirDoc(db, "gold", id, docId, { validado: true, data: hojeLisboa() }, req.actor!.id);
      await inserirNota(db, "gold", id, req.actor!.name, req.actor!.id, `Documento validado · ${docId}`);
    }
    await audit(db, req.actor!.id, "formando.doc_validado", `formandos_${regime}`, String(id), req.ip, { docId });
    return regime === "fin" ? vistaDocumentosFormandoFin(db, id) : { ok: true };
  });

  app.post("/v1/formandos/:regime/:id/documentos/:docId/recusar", async (req, reply) => {
    const v = validar(reply, { params: docParam, body: z.object({ observacao: z.string().trim().min(1, "Escreva o que está incorrecto.").max(500) }) }, req);
    if (!v || !equipa(req, reply, v.params.regime)) return;
    const { regime, id, docId } = v.params;
    if (regime === "fin") {
      const r = await recusarDocFormandoFin(db, id, docId, v.body.observacao, req.actor!);
      if (!r.ok) return reply.code(400).send({ error: r.error });
    } else {
      if (!await docDoFormando(db, "gold", id, docId)) return reply.code(404).send({ error: "documento inexistente" });
      await decidirDoc(db, "gold", id, docId, { validado: false, observacao: v.body.observacao }, req.actor!.id);
      await inserirNota(db, "gold", id, req.actor!.name, req.actor!.id, `Documento recusado · ${docId}: ${v.body.observacao}`);
    }
    await audit(db, req.actor!.id, "formando.doc_recusado", `formandos_${regime}`, String(id), req.ip, { docId });
    return regime === "fin" ? vistaDocumentosFormandoFin(db, id) : { ok: true };
  });

  // Gold: pedir o pagamento por email (transferência com IBAN; o comprovativo volta à secretaria).
  app.post("/v1/formandos/gold/:id/pedir-pagamento", async (req, reply) => {
    const v = validar(reply, { params: z.object({ id: idNum }) }, req);
    if (!v || !equipa(req, reply, "gold")) return;
    const id = v.params.id;
    const f = await dadosBasicos(db, "gold", id);
    if (!f) return reply.code(404).send({ error: "formando inexistente" });
    const valor = Number(f.valor ?? 0);
    if (f.pago || /^oferta$/i.test(f.metodo) || valor <= 0) return reply.code(409).send({ error: "Esta ficha não tem pagamento por fazer." });
    const email = normalizeEmail(f.email);
    if (!isEmail(email)) return reply.code(400).send({ error: "A ficha não tem um email válido." });
    const ent = await lerEntidade(db);
    if (!ent.iban) return reply.code(409).send({ error: "Falta o IBAN da entidade em Configurações › Entidade." });
    const nome = `${f.nome} ${f.apelido}`.trim();
    const hoje = carimboUtc();
    await garantirPagamentoPendente(db, {
      novoId: `TRX-${await nextOpsId(db)}`, formandoId: id, turmaId: f.turma_id, nome, email, curso: f.curso, valor, data: hoje,
    });
    const iban = ent.iban.replace(/(.{4})/g, "$1 ").trim();
    const titular = ent.titularConta || ent.nome;
    const linhas = [
      `Para concluir a inscrição em ${f.curso}, faça o pagamento de € ${fmtEuros(valor)} por transferência bancária.`,
      `IBAN: ${iban} · Titular: ${titular}`,
      "Depois responda a este email com o comprovativo da transferência.",
      "Assim que o pagamento for confirmado pela secretaria, recebe a confirmação por email.",
    ];
    const href = `${config.appOrigin.replace(/\/$/, "")}/area-formando`;
    const mail = renderAutomaticEmail({ nome, xml: "", linhas, cta: "Abrir a área do formando", href, vars: { nome, curso: f.curso }, origin: config.appOrigin });
    await sendMail(db, { to: email, name: nome, subject: `Pagamento da inscrição em ${f.curso}`, text: mail.text, html: mail.html });
    await inserirNota(db, "gold", id, req.actor!.name, req.actor!.id, `Pagamento pedido por email · € ${fmtEuros(valor)} por transferência.`);
    await audit(db, req.actor!.id, "formando.pagamento_pedido", "formandos_gold", String(id), req.ip, { valor });
    return { ok: true, valor };
  });

  // Gold: a secretaria regista um pagamento recebido (transferência, numerário…) ou uma oferta.
  app.post("/v1/formandos/gold/:id/registar-pagamento", async (req, reply) => {
    const v = validar(reply, {
      params: z.object({ id: idNum }),
      body: z.object({
        metodo: z.string().trim().min(1).max(40),
        valor: z.number().min(0).max(100_000).optional(),
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }),
    }, req);
    if (!v || !equipa(req, reply, "gold")) return;
    if (!pode(req.actor!.role, "pagamentos.confirmar")) return reply.code(403).send({ error: "Só a secretaria regista pagamentos." });
    const id = v.params.id;
    const f = await dadosBasicos(db, "gold", id);
    if (!f) return reply.code(404).send({ error: "formando inexistente" });
    const oferta = /^oferta$/i.test(v.body.metodo);
    const valor = oferta ? 0 : v.body.valor ?? Number(f.valor ?? 0);
    const metodo = oferta ? "Oferta" : v.body.metodo;
    const data = v.body.data ?? hojeLisboa();
    const novoId = `TRX-${await nextOpsId(db)}`;
    const registado = await db.tx(q => registarPagamentoRecebido(q, {
      novoId, formandoId: id, turmaId: f.turma_id, nome: `${f.nome} ${f.apelido}`.trim(), email: normalizeEmail(f.email),
      curso: f.curso, valor, metodo, data,
    }));
    if (!registado) return reply.code(409).send({ error: "Esta inscrição já está paga." });
    await inserirNota(db, "gold", id, req.actor!.name, req.actor!.id, oferta ? "Inscrição oferecida pela ENA." : `Pagamento registado · € ${fmtEuros(valor)} · ${metodo}.`);
    await audit(db, req.actor!.id, "formando.pagamento_registado", "formandos_gold", String(id), req.ip, { valor, metodo });
    return { ok: true };
  });
}
