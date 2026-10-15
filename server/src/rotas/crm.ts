/**
 * CRM das pré-inscrições: lista paginada com filas e filtros, ficha (dossiê), notas, campos,
 * etiquetas, acções em lote, documentos, validação, pedido de pagamento e nova ligação pessoal.
 */
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import { exportCrmLeads, queryCrmLeads, searchCrmLeads } from "../crm.js";
import { addLeadNota, createCrmCampo, createCrmEtiqueta, deleteCrmEtiqueta, findDuplicados, fixarNota, getLeadDossier, listCrmCampos, listCrmEtiquetas, setCampoValores } from "../crmDossier.js";
import {
  CrmErro, actualizarLeadCrm, aplicarLote, apagarLead, completarLead, contactarLead, criarLeadManual,
} from "../crmLeadsServico.js";
import { fmtDataCalendario, fmtStampLisboa, hojeLisboa } from "../datas.js";
import { globalSearch } from "../globalSearch.js";
import { registerWhatsappRoutes } from "../whatsapp.js";
import { idParam, textoQuery, validar } from "../validacao.js";
import { registarDocumentosCrm } from "./crmDocumentos.js";
import { registarFaturacao } from "./faturacao.js";
import { turmasDoFormador } from "../sessaoAcesso.js";
import * as leads from "../repos/leads.js";
import type { Deps } from "./tipos.js";

const fila = z.enum(["contactar", "atrasados", "hoje", "agenda", "converter", "abertos", "secretaria", "preinscricao", "minhas"]);
const sort = z.enum(["inscrito", "proximo", "valor", "nome", "actividade", "comercial", "origem", "meio", "etiqueta", "curso", "turma", "estado"]);
const dataIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const vazioUndef = (v: unknown) => (v === "" ? undefined : v);

/** Filtros da lista (iguais na lista, na exportação e no pipeline). */
const listaQuery = z.object({
  q: textoQuery(80),
  estado: textoQuery(40),
  curso: textoQuery(200),
  local: textoQuery(120),
  origem: textoQuery(80),
  entrada: z.preprocess(vazioUndef, z.enum(["preinscricao", "manual"]).optional()),
  campanha: textoQuery(80),
  campanhaId: z.preprocess(vazioUndef, z.coerce.number().int().positive().optional()),
  comercialId: textoQuery(40),
  fila: z.preprocess(vazioUndef, fila.optional()),
  regime: z.preprocess(vazioUndef, z.enum(["gold", "fin"]).optional()),
  de: z.preprocess(vazioUndef, dataIso.optional()),
  ate: z.preprocess(vazioUndef, dataIso.optional()),
  page: z.coerce.number().int().min(1).max(100_000).default(1),
  perPage: z.coerce.number().int().min(10).max(100).default(50),
  sort: z.preprocess(vazioUndef, sort.default("inscrito")),
  dir: z.preprocess(vazioUndef, z.enum(["asc", "desc"]).default("desc")),
  kanban: z.preprocess(v => v === "1" || v === "true" || v === true, z.boolean()).default(false),
});

/** Campos da ficha que a equipa pode escrever. */
export const leadSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  apelido: z.string().trim().max(80).optional().default(""),
  email: z.string().trim().max(254).optional().default(""),
  telf: z.string().trim().max(30).optional().default(""),
  concelho: z.string().trim().max(80).optional().default(""),
  origem: z.string().trim().max(80).optional().default(""),
  nota: z.string().max(2000).optional(),
  curso: z.string().trim().max(200).optional().default(""),
  local: z.string().trim().max(120).optional().default(""),
  inicioCurso: z.string().trim().max(40).optional().default("-"),
  horario: z.string().trim().max(80).optional().default(""),
  turmaId: z.preprocess(v => (v === 0 || v === null || v === "" ? undefined : v), z.number().int().positive().optional()),
  preco: z.number().min(0).max(20000).optional(),
  campanha: z.string().trim().max(80).optional(),
  campanhaId: z.number().int().positive().nullable().optional(),
  estado: z.string().trim().max(40).optional(),
  proximoContacto: z.string().trim().max(40).optional(),
  notas: z.string().max(4000).optional(),
  comercialId: z.string().uuid().optional().nullable(),
  meioContacto: z.string().trim().max(40).optional(),
  etiquetaId: z.number().int().positive().nullable().optional(),
  nif: z.string().trim().max(20).optional(),
  moradaFiscal: z.string().trim().max(200).optional(),
  codigoPostal: z.string().trim().max(20).optional(),
  motivoDesistencia: z.string().trim().max(80).optional(),
  pagamentoMetodo: z.string().trim().max(40).optional(),
  regime: z.enum(["gold", "fin"]).optional(),
});

/** Na edição só entram os campos enviados (sem os valores por omissão da criação). */
const leadPatch = z.object(Object.fromEntries(
  Object.entries(leadSchema.shape).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()]),
));

const loteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(100),
  acao: z.enum(["contactar", "estado", "seguimento", "atribuir", "etiqueta", "adiar"]),
  estado: z.string().trim().max(40).optional(),
  proximoContacto: z.string().trim().max(40).optional(),
  nota: z.string().max(800).optional(),
  comercialId: z.string().uuid().optional(),
  etiquetaId: z.number().int().positive().nullable().optional(),
  dias: z.number().int().min(1).max(30).optional(),
});

/** Responde ao erro de regra (400/404/409) e devolve true; outros erros sobem. */
export function erroCrm(reply: FastifyReply, err: unknown) {
  if (!(err instanceof CrmErro)) throw err;
  reply.code(err.codigo).send({ error: err.message, ...err.extra });
  return true;
}

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;
  registerWhatsappRoutes(app, db, { requireAuth });
  await registarDocumentosCrm(app, deps);
  await registarFaturacao(app, deps);

  app.get("/v1/crm/leads", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: listaQuery }, req);
    if (!v) return;
    return queryCrmLeads(db, { ...v.query, actorId: req.actor!.id }, hojeLisboa());
  });

  app.get("/v1/crm/search", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: z.object({ q: textoQuery(80) }) }, req);
    if (!v) return;
    const q = v.query.q ?? "";
    return { leads: q.length < 2 ? [] : await searchCrmLeads(db, q, 12) };
  });

  app.get("/v1/search", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: z.object({ q: textoQuery(120) }) }, req);
    if (!v) return;
    const q = v.query.q ?? "";
    if (!q) return { q: "", kind: "nome", kindLabel: "nome", groups: [], total: 0 };
    const res = await globalSearch(db, q);
    if (req.actor!.role !== "formador") return res;
    // O formador só encontra as próprias turmas.
    const minhas = await turmasDoFormador(db, req.actor!);
    const groups = res.groups
      .filter(g => g.grupo === "turmas")
      .map(g => ({ ...g, items: g.items.filter(h => h.turmaId != null && (h.view.startsWith("fin") ? minhas.fin : minhas.gold).has(h.turmaId)) }))
      .filter(g => g.items.length);
    return { ...res, groups, total: groups.reduce((n, g) => n + g.items.length, 0) };
  });

  app.get("/v1/crm/export", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: listaQuery }, req);
    if (!v) return;
    const rows = await exportCrmLeads(db, { ...v.query, actorId: req.actor!.id }, hojeLisboa());
    const head = ["id", "inscrito", "nome", "apelido", "email", "telf", "curso", "local", "horario", "inicioCurso", "preco", "estado", "origem", "entrada", "meioContacto", "etiquetaNome", "campanha", "proximoContacto"];
    const celula = (k: string, val: unknown) => {
      const s = String(val ?? "");
      if (k === "inscrito") return fmtStampLisboa(s);
      if ((k === "inicioCurso" || k === "proximoContacto") && s && s !== "-") return fmtDataCalendario(s);
      return s;
    };
    // Células começadas por = + - @ ficam como texto (evita fórmulas ao abrir no Excel).
    const esc = (val: string) => {
      const t = /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
      return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const body = [head.join(";"), ...rows.map(r => head.map(k => esc(celula(k, (r as Record<string, unknown>)[k]))).join(";"))].join("\n");
    await audit(db, req.actor!.id, "crm.exportar", "preinscricao", String(rows.length), req.ip);
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", "attachment; filename=crm-leads.csv");
    return reply.send("﻿" + body);
  });

  app.post("/v1/crm/lote", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: loteSchema }, req);
    if (!v) return;
    const r = await aplicarLote(db, req.actor!, v.body);
    await audit(db, req.actor!.id, "crm.lote", "preinscricao", String(v.body.ids.length), req.ip, { acao: v.body.acao, n: r.updated });
    if (r.pagos) await audit(db, req.actor!.id, "preinscricao.pago_manual", "preinscricao", String(r.pagos), req.ip, { lote: true });
    return { updated: r.updated };
  });

  app.get("/v1/crm/campos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return { campos: await listCrmCampos(db) };
  });

  app.post("/v1/crm/campos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, {
      body: z.object({
        label: z.string().trim().min(1).max(80),
        tipo: z.enum(["texto", "numero", "data", "lista"]).optional().default("texto"),
        opcoes: z.array(z.string().trim().min(1).max(80)).max(30).optional().default([]),
      }),
    }, req);
    if (!v) return;
    const campo = await createCrmCampo(db, v.body.label, v.body.tipo, v.body.opcoes);
    await audit(db, req.actor!.id, "crm.campo.create", "crm_campo", String(campo.id), req.ip);
    return { campo };
  });

  app.get("/v1/crm/etiquetas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return { etiquetas: await listCrmEtiquetas(db) };
  });

  app.post("/v1/crm/etiquetas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, {
      body: z.object({ nome: z.string().trim().min(1).max(40), cor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/) }),
    }, req);
    if (!v) return;
    const etiqueta = await createCrmEtiqueta(db, v.body.nome, v.body.cor);
    await audit(db, req.actor!.id, "crm.etiqueta.create", "crm_etiqueta", String(etiqueta.id), req.ip);
    return { etiqueta };
  });

  app.delete("/v1/crm/etiquetas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    await deleteCrmEtiqueta(db, v.params.id);
    await audit(db, req.actor!.id, "crm.etiqueta.apagar", "crm_etiqueta", String(v.params.id), req.ip);
    return { ok: true };
  });

  app.get("/v1/crm/leads/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const dossier = await getLeadDossier(db, v.params.id);
    if (!dossier) return reply.code(404).send({ error: "pré-inscrição inexistente" });
    return dossier;
  });

  app.post("/v1/crm/leads/:id/campos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, {
      params: idParam,
      body: z.object({ valores: z.array(z.object({ campoId: z.number().int().positive(), valor: z.string().max(2000) })).min(1).max(40) }),
    }, req);
    if (!v) return;
    if (!(await leads.existe(db, v.params.id))) return reply.code(404).send({ error: "pré-inscrição inexistente" });
    await setCampoValores(db, v.params.id, req.actor!.id, v.body.valores);
    return getLeadDossier(db, v.params.id);
  });

  app.post("/v1/crm/leads/:id/notas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, {
      params: idParam,
      body: z.object({
        nota: z.string().trim().max(2000).optional().default(""),
        meio: z.string().trim().max(40).optional(),
        resultado: z.string().trim().max(40).optional(),
      }),
    }, req);
    if (!v) return;
    if (!v.body.nota && !v.body.resultado) return reply.code(400).send({ error: "escreva uma nota ou um resultado" });
    if (!(await leads.existe(db, v.params.id))) return reply.code(404).send({ error: "pré-inscrição inexistente" });
    await addLeadNota(db, v.params.id, req.actor!.id, v.body.nota, v.body.meio ?? "", v.body.resultado ?? "");
    await audit(db, req.actor!.id, "crm.nota", "preinscricao", String(v.params.id), req.ip);
    return getLeadDossier(db, v.params.id);
  });

  app.post("/v1/crm/leads/:id/notas/:nid/fixar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, {
      params: idParam.extend({ nid: z.coerce.number().int().positive() }),
      body: z.object({ fixada: z.boolean().optional() }).optional(),
    }, req);
    if (!v) return;
    await fixarNota(db, v.params.id, v.params.nid, v.body?.fixada !== false);
    return getLeadDossier(db, v.params.id);
  });

  app.get("/v1/crm/duplicados", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, {
      query: z.object({ email: textoQuery(254), telf: textoQuery(30), exceptId: z.coerce.number().int().min(0).optional() }),
    }, req);
    if (!v) return;
    return { duplicados: await findDuplicados(db, v.query.email ?? "", v.query.telf ?? "", v.query.exceptId ?? 0) };
  });

  app.get("/v1/crm/comerciais", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: z.object({ regime: z.preprocess(vazioUndef, z.enum(["gold", "fin"]).optional()) }) }, req);
    if (!v) return;
    const equipa = v.query.regime === "fin" ? "financiada" : v.query.regime === "gold" ? "comercial" : "";
    const perfis = equipa ? [equipa, "admin", "secretaria"] : ["comercial", "financiada", "admin", "secretaria"];
    return { comerciais: await leads.comerciaisActivos(db, perfis) };
  });

  app.post("/v1/crm/leads/:id/completar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: leadPatch }, req);
    if (!v) return;
    try {
      await completarLead(db, req.actor!, v.params.id, v.body);
    } catch (err) {
      if (erroCrm(reply, err)) return;
    }
    await audit(db, req.actor!.id, "crm.completar", "preinscricao", String(v.params.id), req.ip);
    return getLeadDossier(db, v.params.id);
  });

  app.post("/v1/preinscricoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: leadSchema }, req);
    if (!v) return;
    try {
      const r = await criarLeadManual(db, req.actor!, v.body);
      await audit(db, req.actor!.id, "preinscricao.create", "preinscricao", String(r.preinscricao.id), req.ip, { entrada: "manual" });
      return r;
    } catch (err) {
      if (erroCrm(reply, err)) return;
    }
  });

  app.patch("/v1/preinscricoes/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: leadPatch }, req);
    if (!v) return;
    try {
      const r = await actualizarLeadCrm(db, req.actor!, v.params.id, v.body);
      await audit(db, req.actor!.id, "preinscricao.editar", "preinscricao", String(v.params.id), req.ip, { campos: Object.keys(v.body) });
      if (r.pagoManual) await audit(db, req.actor!.id, "preinscricao.pago_manual", "preinscricao", String(v.params.id), req.ip);
      return { preinscricao: r.preinscricao };
    } catch (err) {
      if (erroCrm(reply, err)) return;
    }
  });

  app.post("/v1/preinscricoes/:id/contactar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, {
      params: idParam,
      body: z.object({ nota: z.string().max(800).optional(), meio: z.string().max(40).optional() }).optional(),
    }, req);
    if (!v) return;
    try {
      const preinscricao = await contactarLead(db, req.actor!, v.params.id, (v.body?.nota ?? "").trim(), (v.body?.meio ?? "").trim());
      await audit(db, req.actor!.id, "preinscricao.contactar", "preinscricao", String(v.params.id), req.ip);
      return { preinscricao };
    } catch (err) {
      if (erroCrm(reply, err)) return;
    }
  });

  app.delete("/v1/preinscricoes/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    try {
      const meta = await apagarLead(db, req.actor!, v.params.id);
      await audit(db, req.actor!.id, "preinscricao.apagar", "preinscricao", String(v.params.id), req.ip, meta);
      return { ok: true };
    } catch (err) {
      if (erroCrm(reply, err)) return;
    }
  });

}
