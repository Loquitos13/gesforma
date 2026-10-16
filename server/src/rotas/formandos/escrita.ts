/** Criar, alterar e apagar fichas de formando (Gold e Financiada). */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ingestEvent } from "../../automations.js";
import { apagarDocsDaFicha, reavaliarDocsDoFormando } from "../../docsParaFormando.js";
import { normalizarEstado, validarTransicao } from "../../estados.js";
import { registarDocManualFin } from "../../formandoFinDocs.js";
import { InscricaoErro, garantirVaga, recontar, recontarTurma } from "../../inscricao.js";
import { mapFormandoFin, mapFormandoGold, newPublicId, nextOpsId } from "../../ops.js";
import { ligarPreinscricaoAoFormandoGold, moverDocsParaTurma } from "../../percurso.js";
import { pode } from "../../permissoes/capacidades.js";
import { readFormandoPii, writeFormandoDocs, writeFormandoPiiPatch } from "../../pii.js";
import { precoParaOferta } from "../../precoOferta.js";
import { linhaFormando } from "../../repos/formandos.js";
import {
  apagarFormando, atualizarFormandoFin, atualizarFormandoGold, definirTurmaFin, inserirFormandoFin, inserirFormandoGold,
  registarPagamentoRecebido, temPagamentoPago, turmaFinPorId, turmaFinPorNome, turmaGoldBasica,
} from "../../repos/formandosEscrita.js";
import { idParam, validar } from "../../validacao.js";
import type { Deps } from "../tipos.js";

const docOk = z.object({ ok: z.boolean(), data: z.string().max(40) });
const DOCS_FIN = ["cc", "ch", "cu", "ci", "ce", "morada", "contrato", "rgpd"] as const;

const formandoGold = z.object({
  nome: z.string().trim().min(1).max(80),
  apelido: z.string().trim().max(80).optional().default(""),
  telf: z.string().max(30).optional().default(""),
  email: z.string().trim().max(254).optional().default(""),
  inscrito: z.string().max(40).optional(),
  local: z.string().max(120).optional().default(""),
  curso: z.string().max(200).optional().default(""),
  turma: z.string().max(120).optional().default(""),
  turmaId: z.number().int().positive().optional(),
  estado: z.string().max(40).optional().default("Formando"),
  pago: z.boolean().optional().default(false),
  valor: z.number().min(0).max(100_000).optional().default(0),
  metodo: z.string().max(40).optional().default("-"),
});

const formandoFin = z.object({
  nome: z.string().trim().min(1).max(80),
  apelido: z.string().trim().max(80).optional().default(""),
  turma: z.string().max(120).optional().default(""),
  turmaId: z.number().int().positive().optional(),
  telf: z.string().max(30).optional().default(""),
  email: z.string().trim().max(254).optional().default(""),
  curso: z.string().max(200).optional().default(""),
  estado: z.string().max(40).optional().default("Elegível"),
  ...Object.fromEntries(DOCS_FIN.map(k => [k, docOk.optional()])) as Record<(typeof DOCS_FIN)[number], z.ZodOptional<typeof docOk>>,
});

function agora() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

function proibidoFormador(role: string) {
  return role === "formador" || role === "formando";
}

export function registarEscrita(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.post("/v1/formandos-gold", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (proibidoFormador(req.actor!.role)) return reply.code(403).send({ error: "O formador não inscreve nem transfere formandos." });
    const v = validar(reply, { body: formandoGold }, req);
    if (!v) return;
    const d = v.body;
    let horario = "";
    let local = d.local;
    let curso = d.curso;
    let turmaNome = d.turma;
    if (d.turmaId) {
      const turma = await turmaGoldBasica(db, d.turmaId);
      if (!turma) return reply.code(400).send({ error: "Turma inexistente." });
      curso = turma.curso || curso;
      local = turma.local || local;
      horario = turma.horario || "";
      turmaNome = turma.nome;
    }
    // Inscrição oferecida pela ENA: sem valor a pagar e já regularizada.
    const oferta = /^oferta$/i.test(d.metodo.trim());
    const resolved = curso && !oferta ? await precoParaOferta(db, curso, local, horario) : null;
    const valor = oferta ? 0 : resolved ?? d.valor;
    const pago = oferta ? true : d.pago;
    const metodo = oferta ? "Oferta" : d.metodo;
    const estado = normalizarEstado("formandoGold", d.estado);
    if (!estado) return reply.code(400).send({ error: `Estado inválido: «${d.estado}».` });
    if (pago && !pode(req.actor!.role, "pagamentos.confirmar")) return reply.code(403).send({ error: "Só a secretaria regista pagamentos." });
    const id = await nextOpsId(db);
    // «Já pago»: a ficha nasce por pagar e o pagamento é registado na mesma transação (fica o movimento na tesouraria).
    const pagamentoId = pago ? `TRX-${await nextOpsId(db)}` : null;
    const pii = writeFormandoPiiPatch({ telf: d.telf });
    try {
      await db.tx(async q => {
        if (d.turmaId) await garantirVaga(q, "gold", d.turmaId, { email: d.email });
        await inserirFormandoGold(q, {
          id, nome: d.nome, apelido: d.apelido, telf: pii.telf || d.telf, email: d.email.toLowerCase(), inscrito: d.inscrito || agora(),
          local, curso, turma: turmaNome, turmaId: d.turmaId ?? null, estado, pago: false, valor, metodo, piiEnc: pii.pii_enc ?? "", publicId: newPublicId(),
        });
        if (pagamentoId) {
          await registarPagamentoRecebido(q, {
            novoId: pagamentoId, formandoId: id, turmaId: d.turmaId ?? null, nome: `${d.nome} ${d.apelido}`.trim(), email: d.email.toLowerCase(),
            curso, valor, metodo, data: new Date().toISOString().slice(0, 10),
          });
        }
        await recontarTurma(q, "gold", d.turmaId);
      });
    } catch (err) {
      if (err instanceof InscricaoErro) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
    await audit(db, req.actor!.id, "formando.inscrever", "formandos_gold", String(id), req.ip, { turmaId: d.turmaId ?? null, metodo });
    await ligarPreinscricaoAoFormandoGold(db, id, req.actor!.id).catch(err => req.log.warn({ err }, "pré-inscrição não ligada ao formando"));
    const row = await linhaFormando(db, "gold", id);
    return { formando: row ? mapFormandoGold(row) : { id } };
  });

  app.patch("/v1/formandos-gold/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (proibidoFormador(req.actor!.role)) return reply.code(403).send({ error: "O formador não transfere formandos nem altera pagamentos." });
    const v = validar(reply, { params: idParam, body: formandoGold.partial() }, req);
    if (!v) return;
    const id = v.params.id;
    const d = { ...v.body };
    // Pagamento da ficha só pela secretaria (o preço da turma continua a ser recalculado abaixo).
    if (!pode(req.actor!.role, "pagamentos.confirmar")) { delete d.pago; delete d.valor; delete d.metodo; }
    const atual = await linhaFormando(db, "gold", id);
    if (!atual) return reply.code(404).send({ error: "formando inexistente" });
    if (d.estado !== undefined) {
      const t = validarTransicao("formandoGold", String(atual.estado ?? ""), d.estado, req.actor!.role);
      if (!t.ok) return reply.code(409).send({ error: t.erro });
      d.estado = t.estado;
    }
    const turmaAntes = atual.turma_id == null ? null : Number(atual.turma_id);
    if (d.turmaId && d.turmaId !== turmaAntes) {
      try {
        await db.tx(q => garantirVaga(q, "gold", d.turmaId!, { email: d.email ?? String(atual.email ?? ""), excluirFormandoId: id }));
      } catch (err) {
        if (err instanceof InscricaoErro) return reply.code(err.status).send({ error: err.message });
        throw err;
      }
    }
    if (d.turmaId !== undefined || d.local !== undefined || d.curso !== undefined) {
      const turmaId = d.turmaId ?? (atual.turma_id == null ? undefined : Number(atual.turma_id));
      let curso = d.curso ?? String(atual.curso ?? "");
      let local = d.local ?? String(atual.local ?? "");
      let horario = "";
      if (turmaId) {
        const turma = await turmaGoldBasica(db, turmaId);
        if (turma) {
          curso = turma.curso || curso;
          local = turma.local || local;
          horario = turma.horario || "";
          if (d.turmaId) { d.turma = turma.nome; d.curso = curso; d.local = local; }
        }
      }
      const oferta = /^oferta$/i.test(String(d.metodo ?? atual.metodo ?? ""));
      const resolved = curso && !oferta ? await precoParaOferta(db, curso, local, horario) : null;
      if (resolved != null) d.valor = resolved;
    }
    if (d.metodo && /^oferta$/i.test(d.metodo)) { d.metodo = "Oferta"; d.valor = 0; d.pago = true; }
    // A ficha e os pagamentos nunca divergem: marcar pago regista o movimento; desmarcar exige reembolsar/cancelar.
    if (d.pago === false && atual.pago && await temPagamentoPago(db, id)) {
      return reply.code(409).send({ error: "Esta ficha tem um pagamento recebido: reembolse ou cancele-o em Pagamentos." });
    }
    if (d.pago === true && !atual.pago) {
      const valor = d.valor ?? Number(atual.valor ?? 0);
      const metodo = d.metodo ?? String(atual.metodo ?? "");
      const novoId = `TRX-${await nextOpsId(db)}`;
      const registado = await db.tx(q => registarPagamentoRecebido(q, {
        novoId, formandoId: id, turmaId: atual.turma_id == null ? null : Number(atual.turma_id),
        nome: `${d.nome ?? atual.nome ?? ""} ${d.apelido ?? atual.apelido ?? ""}`.trim(), email: String(d.email ?? atual.email ?? "").toLowerCase(),
        curso: d.curso ?? String(atual.curso ?? ""), valor, metodo, data: new Date().toISOString().slice(0, 10),
      }));
      if (!registado) return reply.code(409).send({ error: "Esta inscrição já está paga." });
      delete d.pago;
    }
    const pii = d.telf !== undefined ? writeFormandoPiiPatch({ telf: d.telf }, readFormandoPii(atual)) : null;
    await atualizarFormandoGold(db, id, {
      ...d, email: d.email?.toLowerCase(), telf: pii ? pii.telf : undefined, piiEnc: pii?.pii_enc ?? undefined,
    }, newPublicId());
    const row = await linhaFormando(db, "gold", id);
    const mapped = row ? mapFormandoGold(row) : null;
    if (d.turmaId !== undefined || d.estado !== undefined) await recontar(db, "gold", turmaAntes, mapped?.turmaId || null);
    if (d.estado !== undefined || (d.turmaId !== undefined && d.turmaId !== turmaAntes)) {
      await audit(db, req.actor!.id, "formando.alterar", "formandos_gold", String(id), req.ip, { estado: d.estado, turmaDe: turmaAntes, turmaPara: d.turmaId });
      // Colocado numa turma: liga a pré-inscrição validada; mudou de turma/curso ou desistiu: os documentos da ligação saem.
      if (mapped?.turmaId) await ligarPreinscricaoAoFormandoGold(db, id, req.actor!.id).catch(() => undefined);
      await reavaliarDocsDoFormando(db, "gold", id, req.actor!.id).catch(() => undefined);
    } else if (Object.keys(d).length) {
      await audit(db, req.actor!.id, "formando.alterar", "formandos_gold", String(id), req.ip, { campos: Object.keys(d) });
    }
    if (mapped?.email && d.turmaId && mapped.turmaId) {
      await moverDocsParaTurma(db, { email: mapped.email, turmaId: mapped.turmaId, curso: mapped.curso, regime: "gold" }).catch(() => undefined);
    }
    if (mapped && d.estado && /conclu/i.test(d.estado) && mapped.email) {
      await ingestEvent(db, "formando.completed", {
        email: mapped.email, nome: `${mapped.nome} ${mapped.apelido}`.trim(), curso: mapped.curso, turma: mapped.turma,
      }, `formando.completed:${id}`).catch(() => undefined);
    }
    return { formando: mapped };
  });

  for (const regime of ["gold", "fin"] as const) {
    app.delete(`/v1/formandos-${regime}/:id`, async (req, reply) => {
      if (!requireAuth(req, reply)) return;
      if (proibidoFormador(req.actor!.role)) return reply.code(403).send({ error: "O formador não remove formandos da turma." });
      const v = validar(reply, { params: idParam }, req);
      if (!v) return;
      const antes = await apagarFormando(db, regime, v.params.id);
      if (!antes) return reply.code(404).send({ error: "formando inexistente" });
      await apagarDocsDaFicha(db, regime, v.params.id);
      await recontar(db, regime, antes.turma_id == null ? null : Number(antes.turma_id));
      await audit(db, req.actor!.id, "formando.apagar", `formandos_${regime}`, String(v.params.id), req.ip, {
        nome: `${antes.nome ?? ""} ${antes.apelido ?? ""}`.trim(),
      });
      return { ok: true };
    });
  }

  app.post("/v1/formandos-fin", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (proibidoFormador(req.actor!.role)) return reply.code(403).send({ error: "O formador não inscreve nem transfere formandos." });
    const v = validar(reply, { body: formandoFin }, req);
    if (!v) return;
    const d = v.body;
    const vazio = { ok: false, data: "" };
    const docs = Object.fromEntries(DOCS_FIN.map(k => [k, d[k] ?? vazio])) as Record<(typeof DOCS_FIN)[number], { ok: boolean; data: string }>;
    const docPack = writeFormandoDocs(docs);
    const pii = writeFormandoPiiPatch({ telf: d.telf });
    const turma = d.turmaId ? await turmaFinPorId(db, d.turmaId) : d.turma ? await turmaFinPorNome(db, d.turma) : null;
    if (d.turmaId && !turma) return reply.code(400).send({ error: "Turma inexistente." });
    const estado = normalizarEstado("formandoFin", d.estado);
    if (!estado) return reply.code(400).send({ error: `Estado inválido: «${d.estado}».` });
    const turmaId = turma ? Number(turma.id) : null;
    const id = await nextOpsId(db);
    try {
      await db.tx(async q => {
        if (turmaId) await garantirVaga(q, "fin", turmaId, { email: d.email });
        await inserirFormandoFin(q, {
          id, nome: d.nome, apelido: d.apelido, turma: turma?.nome ?? d.turma, turmaId, telf: pii.telf || d.telf, email: d.email.toLowerCase(),
          curso: d.curso || turma?.curso || "", estado, docs: docPack.docs, docsEnc: docPack.docs_enc, piiEnc: pii.pii_enc ?? "", publicId: newPublicId(),
        });
        await recontarTurma(q, "fin", turmaId);
      });
    } catch (err) {
      if (err instanceof InscricaoErro) return reply.code(err.status).send({ error: err.message });
      throw err;
    }
    for (const [docId, doc] of Object.entries(docs)) {
      if (doc.ok) await registarDocManualFin(db, id, docId, true, { id: req.actor!.id, name: req.actor!.name });
    }
    await audit(db, req.actor!.id, "formando.inscrever", "formandos_fin", String(id), req.ip, { turmaId });
    if (turmaId) await reavaliarDocsDoFormando(db, "fin", id, req.actor!.id).catch(() => undefined);
    const row = await linhaFormando(db, "fin", id);
    return { formando: row ? mapFormandoFin(row) : { id } };
  });

  app.patch("/v1/formandos-fin/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (proibidoFormador(req.actor!.role)) return reply.code(403).send({ error: "O formador não transfere formandos." });
    const v = validar(reply, { params: idParam, body: formandoFin.partial() }, req);
    if (!v) return;
    const id = v.params.id;
    const d = { ...v.body };
    const current = await linhaFormando(db, "fin", id);
    if (!current) return reply.code(404).send({ error: "inexistente" });
    const prev = mapFormandoFin(current);
    if (d.estado !== undefined) {
      const t = validarTransicao("formandoFin", prev.estado, d.estado, req.actor!.role);
      if (!t.ok) return reply.code(409).send({ error: t.erro });
      d.estado = t.estado;
    }
    const turmaAntes = current.turma_id == null ? null : Number(current.turma_id);
    const mudaTurma = d.turmaId != null || d.turma != null;
    const turmaNova = d.turmaId ? await turmaFinPorId(db, d.turmaId) : d.turma ? await turmaFinPorNome(db, d.turma) : null;
    if (d.turmaId && !turmaNova) return reply.code(400).send({ error: "Turma inexistente." });
    if (turmaNova && Number(turmaNova.id) !== turmaAntes) {
      try {
        await db.tx(q => garantirVaga(q, "fin", Number(turmaNova.id), { email: d.email ?? prev.email, excluirFormandoId: id }));
      } catch (err) {
        if (err instanceof InscricaoErro) return reply.code(err.status).send({ error: err.message });
        throw err;
      }
    }
    if (turmaNova) d.turma = turmaNova.nome;
    const docs = Object.fromEntries(DOCS_FIN.map(k => [k, d[k] ?? prev[k]])) as Record<(typeof DOCS_FIN)[number], { ok: boolean; data: string }>;
    const docPack = writeFormandoDocs(docs);
    const pii = writeFormandoPiiPatch({ telf: d.telf ?? readFormandoPii(current).telf }, readFormandoPii(current));
    await atualizarFormandoFin(db, id, {
      nome: d.nome, apelido: d.apelido, turma: d.turma, telf: pii.pii_enc ? "" : d.telf, email: d.email?.toLowerCase(), curso: d.curso,
      estado: d.estado, docs: docPack.docs, docsEnc: docPack.docs_enc, piiEnc: pii.pii_enc,
    }, newPublicId());
    // Documentos marcados ou desmarcados à mão ficam registados com quem validou.
    for (const doc of DOCS_FIN) {
      const novo = d[doc];
      if (novo && novo.ok !== prev[doc].ok) await registarDocManualFin(db, id, doc, novo.ok, { id: req.actor!.id, name: req.actor!.name });
    }
    if (mudaTurma) {
      await definirTurmaFin(db, id, turmaNova ? Number(turmaNova.id) : null);
      const email = String(current.email ?? "");
      if (turmaNova && email) {
        await moverDocsParaTurma(db, { email, turmaId: Number(turmaNova.id), curso: String(turmaNova.curso ?? current.curso ?? ""), regime: "fin" }).catch(() => undefined);
      }
    }
    const row = await linhaFormando(db, "fin", id);
    if (mudaTurma || d.estado !== undefined) {
      await recontar(db, "fin", turmaAntes, row?.turma_id == null ? null : Number(row.turma_id));
      await audit(db, req.actor!.id, "formando.alterar", "formandos_fin", String(id), req.ip, { estado: d.estado, turmaDe: turmaAntes, turma: d.turma });
      await reavaliarDocsDoFormando(db, "fin", id, req.actor!.id).catch(() => undefined);
    } else if (Object.keys(d).length) {
      await audit(db, req.actor!.id, "formando.alterar", "formandos_fin", String(id), req.ip, { campos: Object.keys(d) });
    }
    return { formando: row ? mapFormandoFin(row) : null };
  });

  app.post("/v1/formandos-fin/:id/lembrete-documentos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (proibidoFormador(req.actor!.role)) return reply.code(403).send({ error: "Sem permissão." });
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const { enviarLembreteDocsFin } = await import("../../finPipeline.js");
    const r = await enviarLembreteDocsFin(db, v.params.id, req.actor!.id);
    if (!r.enviado) return reply.code(400).send({ error: r.erro ?? "Não foi possível enviar." });
    await audit(db, req.actor!.id, "formando.lembrete_docs", "formandos_fin", String(v.params.id), req.ip);
    return { ok: true };
  });
}
