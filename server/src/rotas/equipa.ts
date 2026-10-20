/** Equipa comercial (Gold) e da Financiada: carteira, indicadores do período e ficha de cada pessoa. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { logLeadEvent } from "../crmDossier.js";
import { mapPreinscricao } from "../ops.js";
import { precoParaOferta } from "../precoOferta.js";
import { ESTADOS_PROPOSTA } from "../repos/crmDiretorio.js";
import { criarProposta, obterModelo, obterProposta } from "../repos/crmDiretorioDocs.js";
import { linhaVisivel } from "../repos/crmVisivel.js";
import {
  aSeguir, alterarProposta, atribuirLead, gravarObjetivo, gravarPerfil, indicadoresEquipa, leadDaNota, leadsDoMembro,
  listarMembros, membroExiste, notasDoMembro, propostaComContratoAssinado, regimeDaProposta, registarNota, type Regime,
} from "../repos/equipa.js";
import { periodo } from "../repos/sql.js";
import { idParam, periodoQuery, regime as regimeEnum, textoQuery, validar, BODY_LIMIT_DOC, corpoDoc } from "../validacao.js";
import type { Deps } from "./tipos.js";

const regimeQuery = z.object({ regime: z.preprocess(v => (v === "" || v == null ? "gold" : v), regimeEnum) }).merge(periodoQuery);
const membroParam = z.object({ id: z.string().uuid() });

const propostaSchema = z.object({
  preinscricaoId: z.number().int().positive().nullable().optional().default(null),
  clienteNome: z.string().trim().min(2, "indique o cliente").max(160),
  clienteEmail: z.string().trim().max(254).optional().default(""),
  curso: z.string().trim().max(200).optional().default(""),
  valor: z.number().min(0).max(1_000_000).optional().default(0),
  estado: z.enum(ESTADOS_PROPOSTA).optional().default("Enviada"),
  respostaCliente: z.string().trim().max(4000).optional().default(""),
  notas: z.string().trim().max(4000).optional().default(""),
  corpo: corpoDoc.optional().default(""),
  templateId: z.number().int().positive().nullable().optional().default(null),
  clienteId: z.number().int().positive().nullable().optional().default(null),
  regime: regimeEnum.optional().default("gold"),
});
const propostaPatch = z.object({
  estado: z.enum(ESTADOS_PROPOSTA).optional(),
  respostaCliente: z.string().trim().max(4000).optional(),
  valor: z.number().min(0).max(1_000_000).optional(),
  notas: z.string().trim().max(4000).optional(),
  curso: z.string().trim().max(200).optional(),
  corpo: corpoDoc.optional(),
}).refine(v => Object.keys(v).length > 0, "nada para alterar");

function podeVer(role: string | undefined, regime: Regime) {
  if (role === "admin" || role === "secretaria") return true;
  return role === (regime === "fin" ? "financiada" : "comercial");
}
const eGestao = (req: FastifyRequest) => req.actor?.role === "admin" || req.actor?.role === "secretaria";

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  function exigir(req: FastifyRequest, reply: FastifyReply, regime: Regime) {
    if (!requireAuth(req, reply)) return false;
    if (!podeVer(req.actor?.role, regime)) {
      reply.code(403).send({ error: "Sem acesso a esta equipa." });
      return false;
    }
    return true;
  }

  async function membros(regime: Regime, de?: string, ate?: string, id?: string) {
    const p = periodo(de, ate);
    const [lista, ind] = await Promise.all([listarMembros(db, regime, id), indicadoresEquipa(db, regime, p, id)]);
    return { periodo: p, membros: lista.map(m => ({ ...m, ...ind.porPessoa(m.id) })) };
  }

  app.get("/v1/equipa", async (req, reply) => {
    const v = validar(reply, { query: regimeQuery }, req);
    if (!v || !exigir(req, reply, v.query.regime)) return;
    // O comercial só vê os seus números (as pré-inscrições dos outros não lhe são visíveis).
    const so = req.actor!.role === "comercial" ? req.actor!.id : undefined;
    const { periodo: p, membros: lista } = await membros(v.query.regime, v.query.de, v.query.ate, so);
    const soma = (f: (m: (typeof lista)[number]) => number) => lista.reduce((s, m) => s + f(m), 0);
    return {
      periodo: p,
      totais: {
        membros: lista.length,
        ativos: lista.filter(m => m.ativo).length,
        carteira: soma(m => m.carteira.leads),
        porContactar: soma(m => m.carteira.porContactar),
        pipeline: soma(m => m.carteira.pipeline),
        atual: { leads: soma(m => m.atual.leads), pagos: soma(m => m.atual.pagos), receita: soma(m => m.atual.receita), propostas: soma(m => m.atual.propostas) },
        anterior: { leads: soma(m => m.anterior.leads), pagos: soma(m => m.anterior.pagos), receita: soma(m => m.anterior.receita), propostas: soma(m => m.anterior.propostas) },
      },
      membros: lista,
    };
  });

  app.get("/v1/equipa/preco", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: z.object({ curso: textoQuery(200), local: textoQuery(120), horario: textoQuery(120) }) }, req);
    if (!v) return;
    if (!v.query.curso) return { preco: 0 };
    // O mesmo preço do pedido de pagamento: ficha do curso Gold e regras por local/horário (a Financiada não tem preço).
    return { preco: (await precoParaOferta(db, v.query.curso, v.query.local ?? "", v.query.horario ?? "")) ?? 0 };
  });

  app.get("/v1/equipa/:id", async (req, reply) => {
    const v = validar(reply, { params: membroParam, query: regimeQuery }, req);
    if (!v || !exigir(req, reply, v.query.regime)) return;
    const { regime } = v.query;
    if (req.actor!.role === "comercial" && v.params.id !== req.actor!.id) return reply.code(404).send({ error: "Pessoa não encontrada nesta equipa." });
    const { periodo: p, membros: lista } = await membros(regime, v.query.de, v.query.ate, v.params.id);
    const membro = lista[0];
    if (!membro) return reply.code(404).send({ error: "Pessoa não encontrada nesta equipa." });
    const [leads, notas, seguir] = await Promise.all([
      leadsDoMembro(db, regime, membro.id), notasDoMembro(db, regime, membro.id), aSeguir(db, regime, membro.id),
    ]);
    return { periodo: p, membro, leads: leads.map(r => mapPreinscricao(r as Record<string, unknown>)), notas, seguir };
  });

  app.post("/v1/equipa/:id/propostas", { bodyLimit: BODY_LIMIT_DOC }, async (req, reply) => {
    const v = validar(reply, { params: membroParam, body: propostaSchema }, req);
    if (!v || !exigir(req, reply, v.body.regime)) return;
    const d = v.body;
    if (req.actor!.role === "comercial" && v.params.id !== req.actor!.id) return reply.code(404).send({ error: "Pessoa não encontrada nesta equipa." });
    if (!(await membroExiste(db, d.regime, v.params.id))) return reply.code(404).send({ error: "Pessoa não encontrada nesta equipa." });
    if (d.preinscricaoId && !(await linhaVisivel(db, "preinscricoes", d.preinscricaoId, req.actor!))) {
      return reply.code(404).send({ error: "Pré-inscrição não encontrada." });
    }
    let { curso, valor, corpo } = d;
    if (d.templateId) {
      const t = await obterModelo(db, "proposta", d.templateId);
      if (!t) return reply.code(400).send({ error: "Modelo de proposta inexistente." });
      curso = curso || t.curso;
      valor = valor || t.valor;
      corpo = corpo || t.corpo;
    }
    // Proposta, dono da pré-inscrição e evento no dossiê: tudo ou nada.
    const id = await db.tx(async q => {
      const nova = await criarProposta(q, {
        comercialId: v.params.id, clienteId: d.clienteId, preinscricaoId: d.preinscricaoId, clienteNome: d.clienteNome,
        clienteEmail: d.clienteEmail, curso, valor, estado: d.estado, respostaCliente: d.respostaCliente, notas: d.notas,
        corpo, templateId: d.templateId, regime: d.regime,
      });
      if (d.preinscricaoId) {
        await atribuirLead(q, d.preinscricaoId, v.params.id);
        await logLeadEvent(q, d.preinscricaoId, req.actor!.id, "proposta", `Proposta ${d.estado}`, `${curso} · € ${valor}`);
      }
      return nova;
    });
    await audit(db, req.actor!.id, "proposta.create", "proposta", String(id), req.ip, { comercialId: v.params.id });
    return { proposta: await obterProposta(db, id) };
  });

  app.patch("/v1/equipa/propostas/:id", { bodyLimit: BODY_LIMIT_DOC }, async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: propostaPatch }, req);
    if (!v) return;
    const regime = await regimeDaProposta(db, v.params.id);
    if (!regime) return reply.code(404).send({ error: "Proposta não encontrada." });
    if (!podeVer(req.actor?.role, regime)) return reply.code(403).send({ error: "Sem acesso a esta equipa." });
    const mexeNoTexto = v.body.corpo !== undefined || v.body.valor !== undefined || v.body.curso !== undefined;
    if (mexeNoTexto && (await propostaComContratoAssinado(db, v.params.id))) {
      return reply.code(409).send({ error: "Já há um contrato assinado desta proposta: o texto, o curso e o valor não se alteram." });
    }
    await alterarProposta(db, v.params.id, v.body);
    await audit(db, req.actor!.id, "proposta.update", "proposta", String(v.params.id), req.ip, { campos: Object.keys(v.body) });
    return { proposta: await obterProposta(db, v.params.id) };
  });

  app.post("/v1/equipa/:id/notas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, {
      params: membroParam,
      body: z.object({ preinscricaoId: z.number().int().positive(), nota: z.string().trim().min(1, "escreva a nota").max(4000) }),
    }, req);
    if (!v) return;
    const lead = await linhaVisivel(db, "preinscricoes", v.body.preinscricaoId, req.actor!) ? await leadDaNota(db, v.body.preinscricaoId) : null;
    if (!lead) return reply.code(404).send({ error: "Pré-inscrição não encontrada." });
    if (!podeVer(req.actor?.role, lead.regime === "fin" ? "fin" : "gold")) return reply.code(403).send({ error: "Sem acesso a esta equipa." });
    await db.tx(q => registarNota(q, v.body.preinscricaoId, v.params.id, req.actor!.id, v.body.nota));
    await audit(db, req.actor!.id, "equipa.nota", "preinscricao", String(v.body.preinscricaoId), req.ip);
    await logLeadEvent(db, v.body.preinscricaoId, req.actor!.id, "nota", "Nota comercial", v.body.nota);
    return { ok: true };
  });

  app.put("/v1/equipa/:id/objetivo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!eGestao(req)) return reply.code(403).send({ error: "Sem permissão para definir objectivos." });
    const v = validar(reply, {
      params: membroParam,
      body: z.object({
        metaPct: z.number().min(0).max(100).optional(),
        metaLeads: z.number().int().min(0).max(100000).optional(),
        metaPropostas: z.number().int().min(0).max(100000).optional(),
      }),
    }, req);
    if (!v) return;
    await gravarObjetivo(db, v.params.id, v.body);
    await audit(db, req.actor!.id, "equipa.objetivo", "user", v.params.id, req.ip, v.body);
    return { ok: true, ...v.body };
  });

  app.patch("/v1/equipa/:id/perfil", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (!eGestao(req)) return reply.code(403).send({ error: "Sem permissão para editar o perfil." });
    const v = validar(reply, {
      params: membroParam,
      body: z.object({
        name: z.string().trim().min(2).max(120).optional(),
        telefone: z.string().trim().max(40).optional(),
        nota: z.string().max(2000).optional(),
      }),
    }, req);
    if (!v) return;
    const existe = (await membroExiste(db, "gold", v.params.id)) || (await membroExiste(db, "fin", v.params.id));
    if (!existe) return reply.code(404).send({ error: "Pessoa não encontrada na equipa." });
    await gravarPerfil(db, v.params.id, { nome: v.body.name, telefone: v.body.telefone, nota: v.body.nota });
    await audit(db, req.actor!.id, "equipa.perfil", "user", v.params.id, req.ip);
    return { ok: true };
  });
}
