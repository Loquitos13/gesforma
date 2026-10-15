/** Diretório comercial: clientes (empresas e instituições) e parceiros. Propostas, contratos e modelos em crmDiretorioDocs.ts. */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  alterarCliente, alterarParceiro, apagarCliente, apagarParceiro, bloqueioApagarCliente, criarCliente, criarParceiro,
  existeUtilizador, listarClientes, listarParceiros, obterCliente, resumoClientes,
} from "../repos/crmDiretorio.js";
import { criarProposta, obterClienteBasico } from "../repos/crmDiretorioDocs.js";
import { idParam, paginacao, textoQuery, validar, BODY_LIMIT_DOC, corpoDoc } from "../validacao.js";
import { registarDocs } from "./crmDiretorioDocs.js";
import type { Deps } from "./tipos.js";

const email = z.string().trim().max(160).refine(v => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "email inválido");
const tipoCliente = z.enum(["Empresa", "Particular"]);
const clienteSchema = z.object({
  nome: z.string().trim().min(1, "indique o nome").max(160),
  tipo: tipoCliente.optional().default("Empresa"),
  email: email.optional().default(""),
  telf: z.string().trim().max(40).optional().default(""),
  nif: z.string().trim().max(20).optional().default(""),
  notas: z.string().max(2000).optional().default(""),
});
const clientePatch = z.object({
  nome: z.string().trim().min(1).max(160).optional(),
  tipo: tipoCliente.optional(),
  email: email.optional(),
  telf: z.string().trim().max(40).optional(),
  nif: z.string().trim().max(20).optional(),
  notas: z.string().max(2000).optional(),
}).refine(v => Object.keys(v).length > 0, "nada para alterar");

const parceiroSchema = z.object({
  nome: z.string().trim().min(1, "indique o nome").max(160),
  email: email.optional().default(""),
  telf: z.string().trim().max(40).optional().default(""),
  tipo: z.string().trim().max(80).optional().default(""),
  notas: z.string().max(2000).optional().default(""),
  comercialId: z.string().uuid().nullable().optional().default(null),
  retribuicao: z.string().max(2000).optional().default(""),
});
const parceiroPatch = z.object({
  nome: z.string().trim().min(1).max(160).optional(),
  email: email.optional(),
  telf: z.string().trim().max(40).optional(),
  tipo: z.string().trim().max(80).optional(),
  notas: z.string().max(2000).optional(),
  comercialId: z.string().uuid().nullable().optional(),
  retribuicao: z.string().max(2000).optional(),
}).refine(v => Object.keys(v).length > 0, "nada para alterar");

const propostaClienteSchema = z.object({
  curso: z.string().trim().max(200).optional().default(""),
  valor: z.number().min(0).max(1_000_000).optional().default(0),
  corpo: corpoDoc.optional().default(""),
  comercialId: z.string().uuid().optional(),
  templateId: z.number().int().positive().nullable().optional().default(null),
  notas: z.string().max(4000).optional().default(""),
});

export function eSecretaria(req: FastifyRequest) {
  return req.actor?.role === "admin" || req.actor?.role === "secretaria";
}

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.get("/v1/crm/clientes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: paginacao.extend({ estado: textoQuery(40), tipo: tipoCliente.optional() }) }, req);
    if (!v) return;
    const [pagina, resumo] = await Promise.all([listarClientes(db, v.query), resumoClientes(db)]);
    return { ...pagina, resumo };
  });

  app.get("/v1/crm/clientes/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const cliente = await obterCliente(db, v.params.id);
    if (!cliente) return reply.code(404).send({ error: "Cliente não encontrado." });
    return { cliente };
  });

  app.post("/v1/crm/clientes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: clienteSchema }, req);
    if (!v) return;
    const id = await criarCliente(db, v.body);
    await audit(db, req.actor!.id, "cliente.create", "crm_cliente", String(id), req.ip);
    return { cliente: { id, ...v.body } };
  });

  app.patch("/v1/crm/clientes/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: clientePatch }, req);
    if (!v) return;
    if (!(await alterarCliente(db, v.params.id, v.body))) return reply.code(404).send({ error: "Cliente não encontrado." });
    await audit(db, req.actor!.id, "cliente.update", "crm_cliente", String(v.params.id), req.ip, { campos: Object.keys(v.body) });
    return { ok: true };
  });

  app.delete("/v1/crm/clientes/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    if (!eSecretaria(req)) return reply.code(403).send({ error: "Só a administração ou a secretaria apaga clientes." });
    const bloqueio = await bloqueioApagarCliente(db, v.params.id);
    if (bloqueio) return reply.code(409).send({ error: bloqueio });
    if (!(await apagarCliente(db, v.params.id))) return reply.code(404).send({ error: "Cliente não encontrado." });
    await audit(db, req.actor!.id, "cliente.delete", "crm_cliente", String(v.params.id), req.ip);
    return { ok: true };
  });

  app.post("/v1/crm/clientes/:id/propostas", { bodyLimit: BODY_LIMIT_DOC }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: propostaClienteSchema }, req);
    if (!v) return;
    const cliente = await obterClienteBasico(db, v.params.id);
    if (!cliente) return reply.code(404).send({ error: "Cliente não encontrado." });
    const d = v.body;
    const comercialId = d.comercialId ?? req.actor!.id;
    if (d.comercialId && !(await existeUtilizador(db, d.comercialId))) return reply.code(400).send({ error: "Comercial inexistente." });
    const id = await criarProposta(db, {
      comercialId, clienteId: v.params.id, preinscricaoId: null, clienteNome: cliente.nome, clienteEmail: cliente.email,
      curso: d.curso, valor: d.valor, estado: "Enviada", respostaCliente: "", notas: d.notas, corpo: d.corpo,
      templateId: d.templateId, regime: "gold",
    });
    await audit(db, req.actor!.id, "proposta.create", "proposta", String(id), req.ip, { clienteId: v.params.id });
    return { proposta: { id, curso: d.curso, estado: "Enviada", valor: d.valor, corpo: d.corpo } };
  });

  app.get("/v1/crm/parceiros", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: z.object({ q: textoQuery(120), tipo: textoQuery(80), comercial: textoQuery(40) }) }, req);
    if (!v) return;
    return { parceiros: await listarParceiros(db, v.query) };
  });

  app.post("/v1/crm/parceiros", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: parceiroSchema }, req);
    if (!v) return;
    if (v.body.comercialId && !(await existeUtilizador(db, v.body.comercialId))) return reply.code(400).send({ error: "Comercial inexistente." });
    const id = await criarParceiro(db, v.body);
    await audit(db, req.actor!.id, "parceiro.create", "crm_parceiro", String(id), req.ip);
    return { parceiro: { id, ...v.body } };
  });

  app.patch("/v1/crm/parceiros/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: parceiroPatch }, req);
    if (!v) return;
    if (v.body.comercialId && !(await existeUtilizador(db, v.body.comercialId))) return reply.code(400).send({ error: "Comercial inexistente." });
    if (!(await alterarParceiro(db, v.params.id, v.body))) return reply.code(404).send({ error: "Parceiro não encontrado." });
    await audit(db, req.actor!.id, "parceiro.update", "crm_parceiro", String(v.params.id), req.ip, { campos: Object.keys(v.body) });
    return { ok: true };
  });

  app.delete("/v1/crm/parceiros/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    if (!eSecretaria(req)) return reply.code(403).send({ error: "Só a administração ou a secretaria apaga parceiros." });
    if (!(await apagarParceiro(db, v.params.id))) return reply.code(404).send({ error: "Parceiro não encontrado." });
    await audit(db, req.actor!.id, "parceiro.delete", "crm_parceiro", String(v.params.id), req.ip);
    return { ok: true };
  });

  await registarDocs(app, deps);
}
