/** Avaliação da turma: grelha de notas, certificados, resultados e horas dos formadores. */
import type { FastifyInstance } from "fastify";
import { horasPorFormador } from "../../assiduidade.js";
import { dtpEmFalta } from "../../pedagogia/dtp.js";
import { avaliacaoNotasSchema, certificadoSchema, formandoParam } from "../../pedagogia/esquemas.js";
import { asObj } from "../../pedagogia/util.js";
import { gravarCertificado, gravarNotaCertificado, gravarNotas, listarNotas, sumariosDaTurma } from "../../repos/pedagogiaSessoes.js";
import { custoHoraFormadores, custosDaTurma, formandosDaTurma } from "../../repos/pedagogiaTurma.js";
import { ERRO_TURMA_FECHADA, escalaDaTurma, pendentesDoFecho, resultadosDaTurma, turmaFechada } from "../../resultados.js";
import { nomesDoFormador } from "../../sessaoAcesso.js";
import { regimeIdParam, validar } from "../../validacao.js";
import type { Deps } from "../tipos.js";
import { formadorPodeVer, semFormador, turmaOu404 } from "./comum.js";

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

  app.put("/v1/turmas/:regime/:id/certificados/:formandoId", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: formandoParam, body: certificadoSchema }, req);
    if (!v) return;
    const { regime, id, formandoId } = v.params;
    const c = v.body;
    const emitido = c.ficheiroId ? true : c.emitido;
    const turma = await turmaOu404(db, reply, regime, id);
    if (!turma) return;
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
      const res = await resultadosDaTurma(db, regime, id, { dtpEmFalta: () => dtpEmFalta(db, regime, turma) });
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
    const emFalta = () => dtpEmFalta(db, regime, turma);
    const res = await resultadosDaTurma(db, regime, id, { dtpEmFalta: emFalta });
    if (!res) return reply.code(404).send({ error: "turma não encontrada" });
    const pend = req.actor!.role === "formador" ? null : await pendentesDoFecho(db, regime, id, { dtpEmFalta: emFalta });
    return { ...res, fecho: pend ? { pode: pend.falta.length === 0, falta: pend.falta } : null };
  });

  app.get("/v1/turmas/:regime/:id/horas-formador", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const turma = await custosDaTurma(db, regime, id);
    if (!turma) return reply.code(404).send({ error: "turma não encontrada" });
    const [gravadas, custos] = await Promise.all([sumariosDaTurma(db, regime, id), custoHoraFormadores(db)]);
    const valores = asObj(turma.valores_hora_formador);
    const custoBase = new Map(custos.map(f => [f.nome.trim().toLowerCase(), Number(f.custo_hora) || 0]));
    let formadores = horasPorFormador(turma.cronograma, gravadas).map(h => {
      const valorHora = Number(valores[h.formador]) || custoBase.get(h.formador.trim().toLowerCase()) || 0;
      return { ...h, valorHora, aPagar: Math.round(h.dadas * valorHora * 100) / 100 };
    });
    if (req.actor!.role === "formador") {
      // O formador vê só as próprias horas.
      const meus = new Set([...await nomesDoFormador(db, req.actor!.email, req.actor!.name, req.actor!.id)].map(n => n.toLowerCase()));
      formadores = formadores.filter(f => meus.has(f.formador.trim().toLowerCase()));
    } else if (req.actor!.role === "comercial") {
      formadores = formadores.map(f => ({ ...f, valorHora: 0, aPagar: 0 }));
    }
    return { formadores };
  });
}
