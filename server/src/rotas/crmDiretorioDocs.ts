/** Propostas, contratos e modelos do diretório comercial. Registado a partir de crmDiretorio.ts. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ESTADOS_CONTRATO, ESTADOS_PROPOSTA,
} from "../repos/crmDiretorio.js";
import {
  alterarContrato, alterarModelo, apagarContrato, apagarModelo, contratosPorEstado, criarContrato, criarModelo,
  listarContratos, listarModelos, listarPropostas, obterContrato, obterModelo, obterProposta, propostasPorEstado,
} from "../repos/crmDiretorioDocs.js";
import { regimeDoPedido } from "../crmLeadsServico.js";
import { cancelarAbertas, registarEvento, temAssinaturaConcluida } from "../repos/assinaturas.js";
import { donoDoPedido, linhaVisivel } from "../repos/crmVisivel.js";
import { idNum, idParam, paginacao, regime, textoQuery, validar, BODY_LIMIT_DOC, corpoDoc } from "../validacao.js";
import { eSecretaria } from "./crmDiretorio.js";
import type { Deps } from "./tipos.js";

const tipoModelo = z.enum(["proposta", "contrato"]);
const modeloSchema = z.object({
  nome: z.string().trim().min(1, "indique o nome").max(120),
  curso: z.string().trim().max(200).optional().default(""),
  valor: z.number().min(0).max(1_000_000).optional().default(0),
  corpo: corpoDoc.optional().default(""),
});
const modeloPatch = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  curso: z.string().trim().max(200).optional(),
  valor: z.number().min(0).max(1_000_000).optional(),
  corpo: corpoDoc.optional(),
}).refine(v => Object.keys(v).length > 0, "nada para alterar");

const contratoSchema = z.object({
  clienteNome: z.string().trim().min(1, "indique o cliente").max(160),
  clienteEmail: z.string().trim().max(160).optional().default(""),
  curso: z.string().trim().max(200).optional().default(""),
  valor: z.number().min(0).max(1_000_000).optional().default(0),
  notas: z.string().max(4000).optional().default(""),
  corpo: corpoDoc.optional().default(""),
  templateId: z.number().int().positive().nullable().optional().default(null),
  comercialId: z.string().uuid().optional(),
  clienteId: z.number().int().positive().nullable().optional().default(null),
  propostaId: z.number().int().positive().nullable().optional().default(null),
  regime: regime.optional(),
});
const contratoPatch = z.object({
  clienteNome: z.string().trim().min(1).max(160).optional(),
  clienteEmail: z.string().trim().max(160).optional(),
  curso: z.string().trim().max(200).optional(),
  valor: z.number().min(0).max(1_000_000).optional(),
  estado: z.enum(ESTADOS_CONTRATO).optional(),
  notas: z.string().max(4000).optional(),
  corpo: corpoDoc.optional(),
}).refine(v => Object.keys(v).length > 0, "nada para alterar");

/** O contrato assina-se em papel (definição guardada no corpo pelo editor); sem ela, a assinatura é digital. */
function assinaturaEmPapel(corpo: string) {
  return /data-assinatura=["']?papel\b/.test(corpo);
}

export async function registarDocs(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  // ─── Modelos ───────────────────────────────────────────────────────────────

  app.get("/v1/crm/modelos/:tipo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: z.object({ tipo: tipoModelo }) }, req);
    if (!v) return;
    return { modelos: await listarModelos(db, v.params.tipo) };
  });

  app.post("/v1/crm/modelos/:tipo", { bodyLimit: BODY_LIMIT_DOC }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: z.object({ tipo: tipoModelo }), body: modeloSchema }, req);
    if (!v) return;
    if (!eSecretaria(req)) return reply.code(403).send({ error: "Só a administração ou a secretaria cria modelos." });
    const id = await criarModelo(db, v.params.tipo, v.body);
    await audit(db, req.actor!.id, "modelo.create", `modelo_${v.params.tipo}`, String(id), req.ip);
    return { modelo: { id, tipo: v.params.tipo, ...v.body, usos: 0 } };
  });

  app.patch("/v1/crm/modelos/:tipo/:id", { bodyLimit: BODY_LIMIT_DOC }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: z.object({ tipo: tipoModelo, id: idNum }), body: modeloPatch }, req);
    if (!v) return;
    if (!eSecretaria(req)) return reply.code(403).send({ error: "Só a administração ou a secretaria edita modelos." });
    if (!(await alterarModelo(db, v.params.tipo, v.params.id, v.body))) return reply.code(404).send({ error: "Modelo não encontrado." });
    await audit(db, req.actor!.id, "modelo.update", `modelo_${v.params.tipo}`, String(v.params.id), req.ip);
    return { modelo: await obterModelo(db, v.params.tipo, v.params.id) };
  });

  app.delete("/v1/crm/modelos/:tipo/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: z.object({ tipo: tipoModelo, id: idNum }) }, req);
    if (!v) return;
    if (!eSecretaria(req)) return reply.code(403).send({ error: "Só a administração ou a secretaria apaga modelos." });
    const ok = await db.tx(q => apagarModelo(q, v.params.tipo, v.params.id));
    if (!ok) return reply.code(404).send({ error: "Modelo não encontrado." });
    await audit(db, req.actor!.id, "modelo.delete", `modelo_${v.params.tipo}`, String(v.params.id), req.ip);
    return { ok: true };
  });

  // ─── Propostas ─────────────────────────────────────────────────────────────

  app.get("/v1/crm/propostas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, {
      query: paginacao.extend({
        estado: z.preprocess(x => (x === "" ? undefined : x), z.enum(ESTADOS_PROPOSTA).optional()),
        comercial: textoQuery(40),
        regime: z.preprocess(x => (x === "" ? undefined : x), regime.optional()),
        cliente: z.preprocess(x => (x === "" ? undefined : x), idNum.optional()),
      }),
    }, req);
    if (!v) return;
    const { cliente, ...f } = v.query;
    const [pagina, fases] = await Promise.all([
      listarPropostas(db, { ...f, clienteId: cliente, ator: req.actor! }),
      propostasPorEstado(db, f.regime, req.actor!),
    ]);
    return { ...pagina, fases };
  });

  app.get("/v1/crm/propostas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const proposta = await obterProposta(db, v.params.id);
    if (!proposta) return reply.code(404).send({ error: "Proposta não encontrada." });
    return { proposta };
  });

  // ─── Contratos ─────────────────────────────────────────────────────────────

  app.get("/v1/crm/contratos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, {
      query: paginacao.extend({ estado: z.preprocess(x => (x === "" ? undefined : x), z.enum(ESTADOS_CONTRATO).optional()) }),
    }, req);
    if (!v) return;
    const [pagina, fases] = await Promise.all([listarContratos(db, { ...v.query, ator: req.actor! }), contratosPorEstado(db, req.actor!)]);
    return { ...pagina, fases };
  });

  app.get("/v1/crm/contratos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const contrato = await obterContrato(db, v.params.id);
    if (!contrato) return reply.code(404).send({ error: "Contrato não encontrado." });
    return { contrato };
  });

  app.post("/v1/crm/contratos", { bodyLimit: BODY_LIMIT_DOC }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: contratoSchema }, req);
    if (!v) return;
    const d = v.body;
    let { corpo, curso, valor } = d;
    let clienteId = d.clienteId;
    // O regime fica no contrato (formando_regime): é por ele que a Financiada o vê.
    let regimeContrato = regimeDoPedido(req.actor!.role, d.regime);
    if (d.templateId) {
      const t = await obterModelo(db, "contrato", d.templateId);
      if (!t) return reply.code(400).send({ error: "Modelo de contrato inexistente." });
      corpo = corpo || t.corpo;
      curso = curso || t.curso;
      valor = valor || t.valor;
    }
    if (d.propostaId) {
      const p = await linhaVisivel(db, "propostas_comerciais", d.propostaId, req.actor!) ? await obterProposta(db, d.propostaId) : null;
      if (!p) return reply.code(400).send({ error: "Proposta inexistente." });
      clienteId = clienteId ?? p.clienteId;
      curso = curso || p.curso;
      valor = valor || p.valor;
      corpo = corpo || p.corpo;
      regimeContrato = p.regime === "fin" ? "fin" : "gold";
    }
    const id = await criarContrato(db, {
      comercialId: donoDoPedido(req.actor!, d.comercialId), clienteId, propostaId: d.propostaId, clienteNome: d.clienteNome,
      clienteEmail: d.clienteEmail, curso, valor, notas: d.notas, corpo, templateId: d.templateId, regime: regimeContrato,
    });
    await audit(db, req.actor!.id, "contrato.create", "contrato", String(id), req.ip, { clienteId, propostaId: d.propostaId });
    return { contrato: await obterContrato(db, id) };
  });

  app.patch("/v1/crm/contratos/:id", { bodyLimit: BODY_LIMIT_DOC }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: contratoPatch }, req);
    if (!v) return;
    const atual = await obterContrato(db, v.params.id);
    if (!atual) return reply.code(404).send({ error: "Contrato não encontrado." });
    // Enviado ou assinado, o contrato fica fechado: só se cancela (e o pedido de assinatura aberto fecha-se com ele).
    // Assinado uma vez (assinado_em), fica assim mesmo depois de cancelado: não volta a rascunho nem se apaga.
    const b = v.body;
    const novoEstado = b.estado !== undefined && b.estado !== atual.estado ? b.estado : null;
    if ((novoEstado === "Cancelado" || novoEstado === "Assinado") && !eSecretaria(req)) {
      return reply.code(403).send({ error: "Só a administração ou a secretaria cancela ou marca um contrato como assinado." });
    }
    if (novoEstado === "Assinado" && !assinaturaEmPapel(b.corpo ?? atual.corpo)) {
      return reply.code(409).send({ error: "Este contrato assina-se digitalmente: fica assinado quando o cliente assinar." });
    }
    const fechado = atual.estado === "Por assinar" || atual.estado === "Assinado" || atual.assinadoEm != null
      || await temAssinaturaConcluida(db, atual.id);
    const mudaTexto = (b.corpo !== undefined && b.corpo !== atual.corpo) || (b.curso !== undefined && b.curso !== atual.curso)
      || (b.valor !== undefined && b.valor !== atual.valor);
    const mudaEstado = novoEstado != null && novoEstado !== "Cancelado";
    if (fechado && (mudaTexto || mudaEstado)) {
      return reply.code(409).send({ error: "O contrato já foi enviado para assinatura ou assinado: o texto, o curso, o valor e o estado não se alteram. Pode cancelá-lo." });
    }
    await db.tx(async q => {
      await alterarContrato(q, v.params.id, b);
      if (b.estado === "Cancelado" && atual.estado !== "Cancelado") {
        for (const a of await cancelarAbertas(q, v.params.id, "Contrato cancelado.")) {
          await registarEvento(q, a.id, "cancelado", { ip: req.ip, detalhe: { motivo: "Contrato cancelado." } });
        }
      }
    });
    await audit(db, req.actor!.id, "contrato.update", "contrato", String(v.params.id), req.ip, { campos: Object.keys(v.body), estado: v.body.estado });
    return { contrato: await obterContrato(db, v.params.id) };
  });

  app.delete("/v1/crm/contratos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    if (!eSecretaria(req)) return reply.code(403).send({ error: "Só a administração ou a secretaria apaga contratos." });
    const atual = await obterContrato(db, v.params.id);
    if (!atual) return reply.code(404).send({ error: "Contrato não encontrado." });
    if (atual.estado === "Assinado" || atual.assinadoEm != null || await temAssinaturaConcluida(db, atual.id)) {
      return reply.code(409).send({ error: "Um contrato assinado não se apaga. Pode marcá-lo como cancelado." });
    }
    await apagarContrato(db, v.params.id);
    await audit(db, req.actor!.id, "contrato.delete", "contrato", String(v.params.id), req.ip);
    return { ok: true };
  });
}
