/** Avaliação da turma: grelha de notas, certificados e resultados. */
import type { FastifyInstance } from "fastify";
import { dtpEmFalta } from "../../pedagogia/dtp.js";
import { avaliacaoNotasSchema, avaliacaoQualitativaSchema, certificadoSchema, formandoParam } from "../../pedagogia/esquemas.js";
import { gravarQualitativa, listarQualitativas } from "../../repos/avaliacaoQualitativa.js";
import { avaliacaoQualitativaDaTurma } from "../../documentosFin.js";
import { z } from "zod";
import { gravarCertificado, gravarNotaCertificado, gravarNotas, listarNotas } from "../../repos/pedagogiaSessoes.js";
import { formandosDaTurma } from "../../repos/pedagogiaTurma.js";
import { ERRO_TURMA_FECHADA, escalaDaTurma, pendentesDoFecho, resultadosDaTurma, turmaFechada } from "../../resultados.js";
import { regimeIdParam, validar } from "../../validacao.js";
import type { Deps } from "../tipos.js";
import { enviarPdf, formadorPodeVer, semFormador, turmaOu404 } from "./comum.js";

export function registarAvaliacao(app: FastifyInstance, { db, requireAuth, audit }: Deps) {
  app.get("/v1/turmas/:regime/:id/avaliacao", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    const { regime, id } = v.params;
    if (!(await formadorPodeVer(db, req, reply, regime, id, "Só consulta as notas das turmas em que está atribuído."))) return;
    const rows = await listarNotas(db, regime, id);
    return {
      notas: rows.map(r => ({
        formandoId: Number(r.formando_id),
        moduloId: r.modulo_id ?? "",
        parametroId: r.parametro_id,
        nota: r.nota == null ? null : Number(r.nota),
      })),
    };
  });

  app.put("/v1/turmas/:regime/:id/avaliacao", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam, body: avaliacaoNotasSchema }, req);
    if (!v) return;
    const { regime, id } = v.params;
    if (!semFormador(req, reply, "O formador consulta as notas da turma mas não as altera.")) return;
    if (await turmaFechada(db, regime, id)) return reply.code(409).send({ error: ERRO_TURMA_FECHADA });
    const turma = await turmaOu404(db, reply, regime, id);
    if (!turma) return;
    const daTurma = new Set((await formandosDaTurma(db, regime, turma)).map(f => f.id));
    if (v.body.notas.some(n => n.nota != null && !daTurma.has(n.formandoId))) {
      return reply.code(400).send({ error: "Há notas de formandos que não pertencem a esta turma." });
    }
    const escala = await escalaDaTurma(db, regime, id);
    if (escala && v.body.notas.some(n => n.nota != null && (n.nota < escala.min || n.nota > escala.max))) {
      return reply.code(400).send({ error: `As notas deste curso vão de ${escala.min} a ${escala.max} ${escala.unidade}.` });
    }
    await gravarNotas(fn => db.tx(fn), regime, id, v.body.notas);
    await audit(db, req.actor!.id, "turma.avaliacao", "turma", String(id), req.ip, { regime, notas: v.body.notas.length });
    return { ok: true };
  });

  // ── Ficha individual de avaliação (qualitativa): o formador da turma preenche, a equipa também ──
  app.get("/v1/turmas/:regime/:id/avaliacao-qualitativa", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    const { regime, id } = v.params;
    if (!(await formadorPodeVer(db, req, reply, regime, id, "Só consulta as turmas em que está atribuído."))) return;
    const linhas = await listarQualitativas(db, regime, id);
    const turma = linhas.find(l => Number(l.formando_id) === 0);
    return {
      competencias: String(turma?.dados?.competencias ?? ""),
      formandos: Object.fromEntries(linhas.filter(l => Number(l.formando_id) !== 0)
        .map(l => [Number(l.formando_id), { ...l.dados, atualizadoPor: l.atualizado_por, atualizadoEm: l.atualizado_em }])),
    };
  });

  /** As competências a adquirir: iguais para todos os formandos da turma. */
  app.put("/v1/turmas/:regime/:id/avaliacao-qualitativa/turma", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam, body: z.object({ competencias: z.string().max(4000) }) }, req);
    if (!v) return;
    const { regime, id } = v.params;
    if (!(await formadorPodeVer(db, req, reply, regime, id, "Só preenche as turmas em que está atribuído."))) return;
    if (await turmaFechada(db, regime, id)) return reply.code(409).send({ error: ERRO_TURMA_FECHADA });
    await gravarQualitativa(db, regime, id, 0, { competencias: v.body.competencias }, req.actor!.name);
    await audit(db, req.actor!.id, "turma.avaliacao_qualitativa", "turma", String(id), req.ip, { regime, formando: 0 });
    return { ok: true };
  });

  app.put("/v1/turmas/:regime/:id/avaliacao-qualitativa/:formandoId", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: formandoParam, body: avaliacaoQualitativaSchema }, req);
    if (!v) return;
    const { regime, id, formandoId } = v.params;
    if (!(await formadorPodeVer(db, req, reply, regime, id, "Só preenche as turmas em que está atribuído."))) return;
    if (await turmaFechada(db, regime, id)) return reply.code(409).send({ error: ERRO_TURMA_FECHADA });
    const turma = await turmaOu404(db, reply, regime, id);
    if (!turma) return;
    if (!(await formandosDaTurma(db, regime, turma)).some(f => f.id === formandoId)) {
      return reply.code(400).send({ error: "O formando não pertence a esta turma." });
    }
    await gravarQualitativa(db, regime, id, formandoId, v.body, req.actor!.name);
    await audit(db, req.actor!.id, "turma.avaliacao_qualitativa", "formando", String(formandoId), req.ip, { regime, turma: id });
    return { ok: true };
  });

  /** PDF para o dossiê: a ficha de um formando (`?formando=`) ou as de toda a turma. */
  app.get("/v1/turmas/:regime/:id/avaliacao-qualitativa/pdf", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam, query: z.object({ formando: z.coerce.number().int().positive().optional() }) }, req);
    if (!v) return;
    const { regime, id } = v.params;
    if (!(await formadorPodeVer(db, req, reply, regime, id, "Só consulta as turmas em que está atribuído."))) return;
    const doc = await avaliacaoQualitativaDaTurma(db, regime, id, v.query.formando);
    if (!doc) return reply.code(404).send({ error: "Turma ou formando não encontrado." });
    return enviarPdf(reply, doc.nome, doc.bytes);
  });

  app.put("/v1/turmas/:regime/:id/certificados/:formandoId", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: formandoParam, body: certificadoSchema }, req);
    if (!v) return;
    const { regime, id, formandoId } = v.params;
    const c = v.body;
    const emitido = c.ficheiroId ? true : c.emitido;
    const turma = await turmaOu404(db, reply, regime, id);
    if (!turma) return;
    if (req.actor!.role !== "admin" && await turmaFechada(db, regime, id)) return reply.code(409).send({ error: ERRO_TURMA_FECHADA });
    const membros = new Set((await formandosDaTurma(db, regime, turma)).map(f => f.id));
    if (!membros.has(formandoId)) return reply.code(400).send({ error: "O formando não pertence a esta turma." });
    if (c.nota != null) {
      const escala = await escalaDaTurma(db, regime, id);
      if (escala && (c.nota < escala.min || c.nota > escala.max)) {
        return reply.code(400).send({ error: `As notas deste curso vão de ${escala.min} a ${escala.max} ${escala.unidade}.` });
      }
    }
    if (emitido) {
      // Nota e e-learning entram primeiro: a elegibilidade calcula-se com os valores que chegam agora.
      if (c.nota !== undefined || c.elearning !== undefined) {
        await gravarNotaCertificado(db, regime, id, formandoId, c.nota ?? null, c.elearning ?? null);
      }
      const res = await resultadosDaTurma(db, regime, id, { dtpEmFalta: () => dtpEmFalta(db, regime, turma, "certificado") });
      const r = res?.formandos.find(f => f.id === formandoId);
      if (r && !r.elegivel) {
        if (!(c.forcar && req.actor!.role === "admin")) {
          return reply.code(409).send({ error: `Sem condições para certificado: ${r.motivos.join(" ")}`, motivos: r.motivos });
        }
        await audit(db, req.actor!.id, "turma.certificado_forcado", "formando", String(formandoId), req.ip, { regime, turma: id, motivos: r.motivos });
      }
    }
    await gravarCertificado(db, regime, id, formandoId, {
      emitido: emitido ?? null,
      nota: c.nota ?? null,
      elearning: c.elearning ?? null,
      ficheiroId: c.ficheiroId ?? "",
      ficheiroNome: c.ficheiroNome ?? "",
      ficheiroUrl: c.ficheiroUrl ?? "",
    });
    await audit(db, req.actor!.id, "turma.certificado", "formando", String(formandoId), req.ip, { regime, turma: id, emitido: c.emitido });
    return { ok: true };
  });

  app.get("/v1/turmas/:regime/:id/resultados", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    const { regime, id } = v.params;
    if (!(await formadorPodeVer(db, req, reply, regime, id, "Só consulta as turmas em que está atribuído."))) return;
    const turma = await turmaOu404(db, reply, regime, id);
    if (!turma) return;
    const res = await resultadosDaTurma(db, regime, id, { dtpEmFalta: () => dtpEmFalta(db, regime, turma, "certificado") });
    if (!res) return reply.code(404).send({ error: "turma não encontrada" });
    const pend = req.actor!.role === "formador" ? null : await pendentesDoFecho(db, regime, id, { dtpEmFalta: () => dtpEmFalta(db, regime, turma, "fecho") });
    return { ...res, fecho: pend ? { pode: pend.falta.length === 0, falta: pend.falta } : null };
  });
}
