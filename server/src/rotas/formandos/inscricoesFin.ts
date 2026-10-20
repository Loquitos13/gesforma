/** Financiada › Inscrições (candidaturas por UFCD). Elegível / Colocado na turma cria a ficha do formando. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { hojeLisboa } from "../../datas.js";
import { nextOpsId } from "../../ops.js";
import {
  DOCS_INSCRICAO_FIN, ESTADOS_INSCRICAO_FIN, apagarInscricaoFin, atualizarInscricaoFin, inscricaoFin, inserirInscricaoFin, listarInscricoesFin,
} from "../../repos/inscricoesFin.js";
import { idParam, paginacao, textoQuery, validar } from "../../validacao.js";
import type { Deps } from "../tipos.js";

const emailOuVazio = z.string().trim().max(254).refine(v => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "email inválido");

const corpo = z.object({
  nome: z.string().trim().min(1).max(80),
  apelido: z.string().trim().max(80).default(""),
  email: emailOuVazio.default(""),
  telf: z.string().trim().max(30).default(""),
  curso: z.string().trim().min(1).max(200),
  turma: z.string().trim().max(120).default(""),
  estado: z.enum(ESTADOS_INSCRICAO_FIN).default("Recebida"),
  docs: z.record(z.enum(DOCS_INSCRICAO_FIN), z.boolean()).default({}),
});

const listaQuery = paginacao.extend({
  estado: z.preprocess(v => (v === "" ? undefined : v), z.enum(ESTADOS_INSCRICAO_FIN).optional()),
  curso: textoQuery(200),
  turma: textoQuery(120),
  docs: z.preprocess(v => (v === "" ? undefined : v), z.enum(["completos", "em_falta"]).optional()),
});

async function sincronizarFicha(db: Deps["db"], payload: Record<string, unknown>) {
  const { upsertFormandoFinFromInscricao } = await import("../../finPipeline.js");
  return upsertFormandoFinFromInscricao(db, payload)
    .then(() => null)
    .catch(err => (err instanceof Error ? err.message : "Ficha do formando não actualizada."));
}

export function registarInscricoesFin(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.get("/v1/inscricoes-fin", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: listaQuery }, req);
    if (!v) return;
    const r = await listarInscricoesFin(db, v.query);
    return {
      ...r,
      docsTipos: DOCS_INSCRICAO_FIN,
      linhas: r.linhas.map(l => ({
        id: Number(l.id), inscrito: l.inscrito, nome: l.nome, apelido: l.apelido, email: l.email, telf: l.telf,
        curso: l.curso, ufcd: l.ufcd, turma: l.turma, turmaId: l.turma_id == null ? null : Number(l.turma_id),
        estado: l.estado, docs: l.docs ?? {}, docsValidados: Number(l.docs_ok), formandoId: l.formando_id == null ? null : Number(l.formando_id),
      })),
    };
  });

  app.post("/v1/inscricoes-fin", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: corpo }, req);
    if (!v) return;
    const id = await nextOpsId(db);
    const payload = { ...v.body, email: v.body.email.toLowerCase(), inscrito: hojeLisboa() };
    await inserirInscricaoFin(db, id, payload);
    await audit(db, req.actor!.id, "inscricao_fin.criar", "inscricoes_fin", String(id), req.ip, { estado: payload.estado });
    const aviso = await sincronizarFicha(db, payload);
    return { id, aviso };
  });

  app.patch("/v1/inscricoes-fin/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: corpo.partial() }, req);
    if (!v) return;
    const atual = await inscricaoFin(db, v.params.id);
    if (!atual) return reply.code(404).send({ error: "Inscrição inexistente." });
    const d = Object.fromEntries(Object.entries(v.body).filter(([, x]) => x !== undefined));
    const payload = { ...atual.payload, ...d, ...(typeof d.email === "string" ? { email: d.email.toLowerCase() } : {}) };
    await atualizarInscricaoFin(db, v.params.id, payload);
    await audit(db, req.actor!.id, "inscricao_fin.alterar", "inscricoes_fin", String(v.params.id), req.ip, { campos: Object.keys(d) });
    const aviso = await sincronizarFicha(db, payload);
    return { id: v.params.id, aviso };
  });

  app.delete("/v1/inscricoes-fin/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const antes = await apagarInscricaoFin(db, v.params.id);
    if (!antes) return reply.code(404).send({ error: "Inscrição inexistente." });
    await audit(db, req.actor!.id, "inscricao_fin.apagar", "inscricoes_fin", String(v.params.id), req.ip, {
      nome: `${antes.payload?.nome ?? ""} ${antes.payload?.apelido ?? ""}`.trim(),
    });
    return { ok: true };
  });
}
