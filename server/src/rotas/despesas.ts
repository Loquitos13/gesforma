/** Despesas da Financiada, dentro de cada turma: lista, criar, editar, apagar e exportar no formato do template (Excel). */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { validarDespesa } from "../../../src/partilhado/despesas.js";
import { gerarFicheiroReembolso, MIME_XLSX, sincronizarReembolso, sincronizarSemFalhar } from "../reembolso.js";
import { alterarDespesa, apagarDespesa, associarDespesa, criarDespesa, listarDespesas, turmaDaDespesa, type LinhaDespesa } from "../repos/despesas.js";
import { idNum, idParam, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const dto = (r: LinhaDespesa) => ({ id: Number(r.id), ordem: Number(r.ordem), turmaId: r.turma_id == null ? null : Number(r.turma_id), dados: r.dados, atualizadoEm: r.atualizado_em });
/** `?turma=<id>`, ou `?turma=sem` para as antigas ainda sem turma. */
const turmaQuery = z.object({ turma: z.union([z.literal("sem"), idNum]) });
const corpoDespesa = z.object({ turmaId: idNum.optional(), dados: z.unknown().optional() });

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  /** O ficheiro de despesas da turma na Drive acompanha cada alteração; sem Drive a despesa grava-se na mesma. */
  async function actualizarFicheiro(req: FastifyRequest, turmaId: number | null) {
    if (turmaId == null) return;
    const erro = await sincronizarSemFalhar(db, req.actor!.id, turmaId, "despesas");
    if (erro) req.log.warn({ turma: turmaId, erro }, "ficheiro de despesas da turma não actualizado na Drive");
  }

  app.get("/v1/despesas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const q = validar(reply, { query: turmaQuery }, req);
    if (!q) return;
    return { despesas: (await listarDespesas(db, q.query.turma === "sem" ? null : q.query.turma)).map(dto) };
  });

  app.post("/v1/despesas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const b = validar(reply, { body: corpoDespesa }, req);
    if (!b) return;
    if (!b.body.turmaId || !(await turmaDaDespesa(db, b.body.turmaId))) return reply.code(400).send({ error: "Escolha a turma da despesa." });
    const v = validarDespesa(b.body.dados);
    if (!v.ok) return reply.code(400).send({ error: v.erro });
    const r = await criarDespesa(db, b.body.turmaId, v.dados, req.actor!.id);
    await audit(db, req.actor!.id, "despesa.criar", "despesa", String(r?.id), req.ip, { turmaId: b.body.turmaId });
    await actualizarFicheiro(req, b.body.turmaId);
    return { despesa: r ? dto(r) : null };
  });

  /** Com `dados` altera a despesa; com `turmaId` associa uma despesa antiga (sem turma) a essa turma. */
  app.patch("/v1/despesas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const p = validar(reply, { params: idParam, body: corpoDespesa }, req);
    if (!p) return;
    if (p.body.turmaId) {
      if (!(await turmaDaDespesa(db, p.body.turmaId))) return reply.code(400).send({ error: "Turma não encontrada." });
      const r = await associarDespesa(db, p.params.id, p.body.turmaId);
      if (!r) return reply.code(404).send({ error: "Despesa não encontrada ou já associada a uma turma." });
      await audit(db, req.actor!.id, "despesa.associar", "despesa", String(p.params.id), req.ip, { turmaId: p.body.turmaId });
      await actualizarFicheiro(req, p.body.turmaId);
      return { despesa: dto(r) };
    }
    const v = validarDespesa(p.body.dados);
    if (!v.ok) return reply.code(400).send({ error: v.erro });
    const r = await alterarDespesa(db, p.params.id, v.dados);
    if (!r) return reply.code(404).send({ error: "Despesa não encontrada." });
    await audit(db, req.actor!.id, "despesa.alterar", "despesa", String(p.params.id), req.ip);
    await actualizarFicheiro(req, r.turma_id == null ? null : Number(r.turma_id));
    return { despesa: dto(r) };
  });

  app.delete("/v1/despesas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const p = validar(reply, { params: idParam }, req);
    if (!p) return;
    const apagada = await apagarDespesa(db, p.params.id);
    if (!apagada) return reply.code(404).send({ error: "Despesa não encontrada." });
    await audit(db, req.actor!.id, "despesa.apagar", "despesa", String(p.params.id), req.ip);
    await actualizarFicheiro(req, apagada.turma_id == null ? null : Number(apagada.turma_id));
    return { ok: true };
  });

  /** As despesas da turma, com as mesmas colunas, pela mesma ordem, do template de despesas. */
  app.get("/v1/despesas/exportar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const q = validar(reply, { query: z.object({ turma: idNum }) }, req);
    if (!q) return;
    const g = await gerarFicheiroReembolso(db, q.query.turma, "despesas");
    if (!g) return reply.code(404).send({ error: "Turma não encontrada." });
    const bytes = g.bytes();
    await sincronizarReembolso(db, req.actor!.id, g.turma.id, "despesas", { gerado: { ...g, bytes: () => bytes } })
      .catch(err => req.log.warn({ err, turma: g.turma.id }, "ficheiro de despesas da turma não actualizado na Drive"));
    await audit(db, req.actor!.id, "despesa.exportar", "despesa", undefined, req.ip, { turmaId: g.turma.id });
    reply
      .header("content-type", MIME_XLSX)
      .header("content-disposition", `attachment; filename="${g.nome}"`)
      .header("cache-control", "no-store");
    return reply.send(bytes);
  });
}
