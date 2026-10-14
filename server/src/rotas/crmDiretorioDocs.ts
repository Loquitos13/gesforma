/** Propostas, contratos e modelos do diretório comercial. Registado a partir de crmDiretorio.ts. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  ESTADOS_CONTRATO, ESTADOS_PROPOSTA,
} from "../repos/crmDiretorio.js";
import {
  alterarContrato, alterarModelo, apagarContrato, apagarModelo, contratosPorEstado, criarContrato, criarModelo,
  listarContratos, listarModelos, listarPropostas, obterContrato, obterModelo, obterProposta, propostasPorEstado,
  type TipoModelo,
} from "../repos/crmDiretorioDocs.js";
import { idNum, idParam, paginacao, regime, textoQuery, validar } from "../validacao.js";
import { eSecretaria } from "./crmDiretorio.js";
import type { Deps } from "./tipos.js";

const tipoModelo = z.enum(["proposta", "contrato"]);
const modeloSchema = z.object({
  nome: z.string().trim().min(1, "indique o nome").max(120),
  curso: z.string().trim().max(200).optional().default(""),
  valor: z.number().min(0).max(1_000_000).optional().default(0),
  corpo: z.string().max(20000).optional().default(""),
});
const modeloPatch = z.object({
  nome: z.string().trim().min(1).max(120).optional(),
  curso: z.string().trim().max(200).optional(),
  valor: z.number().min(0).max(1_000_000).optional(),
  corpo: z.string().max(20000).optional(),
}).refine(v => Object.keys(v).length > 0, "nada para alterar");

const contratoSchema = z.object({
  clienteNome: z.string().trim().min(1, "indique o cliente").max(160),
  clienteEmail: z.string().trim().max(160).optional().default(""),
  curso: z.string().trim().max(200).optional().default(""),
  valor: z.number().min(0).max(1_000_000).optional().default(0),
  notas: z.string().max(4000).optional().default(""),
  corpo: z.string().max(20000).optional().default(""),
  templateId: z.number().int().positive().nullable().optional().default(null),
  comercialId: z.string().uuid().optional(),
  clienteId: z.number().int().positive().nullable().optional().default(null),
  propostaId: z.number().int().positive().nullable().optional().default(null),
});
const contratoPatch = z.object({
  clienteNome: z.string().trim().min(1).max(160).optional(),
  clienteEmail: z.string().trim().max(160).optional(),
  curso: z.string().trim().max(200).optional(),
  valor: z.number().min(0).max(1_000_000).optional(),
  estado: z.enum(ESTADOS_CONTRATO).optional(),
  notas: z.string().max(4000).optional(),
  corpo: z.string().max(20000).optional(),
}).refine(v => Object.keys(v).length > 0, "nada para alterar");

export async function registarDocs(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  // ─── Modelos ───────────────────────────────────────────────────────────────

  app.get("/v1/crm/modelos/:tipo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: z.object({ tipo: tipoModelo }) }, req);
    if (!v) return;
    return { modelos: await listarModelos(db, v.params.tipo) };
  });

  app.post("/v1/crm/modelos/:tipo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: z.object({ tipo: tipoModelo }), body: modeloSchema }, req);
    if (!v) return;
    if (!eSecretaria(req)) return reply.code(403).send({ error: "Só a administração ou a secretaria cria modelos." });
    const id = await criarModelo(db, v.params.tipo, v.body);
    await audit(db, req.actor!.id, "modelo.create", `modelo_${v.params.tipo}`, String(id), req.ip);
    return { modelo: { id, tipo: v.params.tipo, ...v.body, usos: 0 } };
  });

  app.patch("/v1/crm/modelos/:tipo/:id", async (req, reply) => {
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

  // Caminhos antigos dos modelos (mesma resposta de antes).
  for (const [caminho, tipo] of [["proposta-templates", "proposta"], ["contrato-templates", "contrato"]] as [string, TipoModelo][]) {
    app.get(`/v1/crm/${caminho}`, async (req, reply) => {
      if (!requireAuth(req, reply)) return;
      return { templates: (await listarModelos(db, tipo)).map(({ id, nome, curso, valor, corpo }) => ({ id, nome, curso, valor, corpo })) };
    });
    app.post(`/v1/crm/${caminho}`, async (req, reply) => {
      if (!requireAuth(req, reply)) return;
      const v = validar(reply, { body: modeloSchema }, req);
      if (!v) return;
      if (!eSecretaria(req)) return reply.code(403).send({ error: "Só a administração ou a secretaria cria templates." });
      const id = await criarModelo(db, tipo, v.body);
      await audit(db, req.actor!.id, "modelo.create", `modelo_${tipo}`, String(id), req.ip);
      return { template: { id, ...v.body } };
    });
  }

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
      listarPropostas(db, { ...f, clienteId: cliente }),
      propostasPorEstado(db, f.regime),
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
    const [pagina, fases] = await Promise.all([listarContratos(db, v.query), contratosPorEstado(db)]);
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

  app.post("/v1/crm/contratos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: contratoSchema }, req);
    if (!v) return;
    const d = v.body;
    let { corpo, curso, valor } = d;
    let clienteId = d.clienteId;
    if (d.templateId) {
      const t = await obterModelo(db, "contrato", d.templateId);
      if (!t) return reply.code(400).send({ error: "Modelo de contrato inexistente." });
      corpo = corpo || t.corpo;
      curso = curso || t.curso;
      valor = valor || t.valor;
    }
    if (d.propostaId) {
      const p = await obterProposta(db, d.propostaId);
      if (!p) return reply.code(400).send({ error: "Proposta inexistente." });
      clienteId = clienteId ?? p.clienteId;
      curso = curso || p.curso;
      valor = valor || p.valor;
      corpo = corpo || p.corpo;
    }
    const id = await criarContrato(db, {
      comercialId: d.comercialId ?? req.actor!.id, clienteId, propostaId: d.propostaId, clienteNome: d.clienteNome,
      clienteEmail: d.clienteEmail, curso, valor, notas: d.notas, corpo, templateId: d.templateId,
    });
    await audit(db, req.actor!.id, "contrato.create", "contrato", String(id), req.ip, { clienteId, propostaId: d.propostaId });
    return { contrato: await obterContrato(db, id) };
  });

  app.patch("/v1/crm/contratos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: contratoPatch }, req);
    if (!v) return;
    const atual = await obterContrato(db, v.params.id);
    if (!atual) return reply.code(404).send({ error: "Contrato não encontrado." });
    if (atual.estado === "Assinado" && (v.body.corpo !== undefined || v.body.valor !== undefined || v.body.curso !== undefined)) {
      return reply.code(409).send({ error: "O contrato já está assinado: o texto, o curso e o valor não se alteram." });
    }
    await alterarContrato(db, v.params.id, v.body);
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
    if (atual.estado === "Assinado") return reply.code(409).send({ error: "Um contrato assinado não se apaga. Pode marcá-lo como cancelado." });
    await apagarContrato(db, v.params.id);
    await audit(db, req.actor!.id, "contrato.delete", "contrato", String(v.params.id), req.ip);
    return { ok: true };
  });
}
