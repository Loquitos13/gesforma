/** Inquéritos: lista com taxa de resposta, resultados por turma, respostas, ligação pública e envio à turma. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { respostaSchema, tokenParam } from "../pedagogia/esquemas.js";
import { metricasInquerito, perguntasDe, publicoInquerito, resumirPerguntas } from "../pedagogia/inqueritos.js";
import { enviarInqueritosDaTurma, tokenDoInquerito, urlInquerito } from "../pedagogia/inqueritosEnvio.js";
import { asObj } from "../pedagogia/util.js";
import * as repo from "../repos/inqueritos.js";
import { idParam, regime, regimeIdParam, textoQuery, validar } from "../validacao.js";
import { semFormador } from "./pedagogia/comum.js";
import type { Deps } from "./tipos.js";

const listaQuery = z.object({ regime: regime.default("gold") });
const resultadosQuery = z.object({ turma: textoQuery(120), curso: textoQuery(200) });

const taxa = (respostas: number, destinatarios: number) => (destinatarios > 0 ? Math.round((Math.min(respostas, destinatarios) / destinatarios) * 100) : null);

function dataCurta(v: string | Date) {
  return (v instanceof Date ? v.toISOString() : String(v)).slice(0, 16).replace("T", " ");
}

export async function registar(app: FastifyInstance, { db, requireAuth, audit }: Deps) {
  app.get("/v1/inqueritos", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, "O formador não consulta os inquéritos.")) return;
    const v = validar(reply, { query: listaQuery }, req);
    if (!v) return;
    const rows = await repo.listarComContagens(db, v.query.regime);
    return {
      inqueritos: rows.map(r => {
        const p = asObj(r.payload);
        return {
          id: Number(r.id),
          titulo: String(p.titulo ?? "Inquérito"),
          publico: publicoInquerito(p),
          estado: String(p.status ?? p.estado ?? "Ativo"),
          perguntas: perguntasDe(p).length,
          turmas: r.turmas,
          destinatarios: r.destinatarios,
          respostas: r.respostas,
          taxa: taxa(r.respostas, r.destinatarios),
          ultimaResposta: r.ultima_resposta,
          ultimoEnvio: r.ultimo_envio,
        };
      }),
    };
  });

  app.get("/v1/inqueritos/:id/resultados", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, "O formador não consulta os inquéritos.")) return;
    const v = validar(reply, { params: idParam, query: resultadosQuery }, req);
    if (!v) return;
    const inq = await repo.lerInquerito(db, v.params.id);
    if (!inq) return reply.code(404).send({ error: "inquérito inexistente" });
    const porTurma = await repo.resultadosPorTurma(db, inq.id, inq.regime, v.query);
    const filtrado = Boolean(v.query.turma || v.query.curso);
    const respostas = await repo.respostasDoInquerito(db, inq.id, {
      turma: v.query.turma,
      turmas: !v.query.turma && v.query.curso ? porTurma.map(t => t.turma) : undefined,
    });
    const destinatarios = porTurma.reduce((s, t) => s + t.destinatarios, 0);
    const payload = asObj(inq.payload);
    return {
      inquerito: { id: inq.id, regime: inq.regime, titulo: String(payload.titulo ?? "Inquérito"), publico: publicoInquerito(payload) },
      resumo: { turmas: porTurma.filter(t => t.turma_id != null).length, destinatarios, respostas: respostas.length, taxa: taxa(respostas.length, destinatarios), filtrado },
      turmas: porTurma.map(t => ({
        turmaId: t.turma_id,
        turma: t.turma,
        curso: t.curso,
        enviados: t.destinatarios,
        respostas: t.respostas,
        taxa: taxa(t.respostas, t.destinatarios),
        enviadoEm: t.enviado_em,
      })),
      perguntas: resumirPerguntas(perguntasDe(payload), respostas.map(r => asObj(r.respostas))),
    };
  });

  app.get("/v1/inqueritos/:id/respostas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const [rows, inq] = await Promise.all([repo.respostasDoInquerito(db, v.params.id, { limite: 200 }), repo.lerInquerito(db, v.params.id)]);
    const respostas = rows.map(r => ({ id: Number(r.id), turma: r.turma, formando: r.formando, respostas: asObj(r.respostas), data: dataCurta(r.created_at) }));
    return { respostas, metricas: metricasInquerito(perguntasDe(asObj(inq?.payload)), respostas.map(r => r.respostas)) };
  });

  app.post("/v1/inqueritos/:id/respostas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: respostaSchema }, req);
    if (!v) return;
    if (!(await repo.lerInquerito(db, v.params.id))) return reply.code(404).send({ error: "inquérito inexistente" });
    await repo.inserirResposta(db, v.params.id, v.body);
    await audit(db, req.actor!.id, "inquerito.resposta", "inquerito", String(v.params.id), req.ip);
    return { ok: true };
  });

  app.get("/v1/inqueritos/:id/publico", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const inq = await repo.lerInquerito(db, v.params.id);
    if (!inq) return reply.code(404).send({ error: "inquérito inexistente" });
    const token = await tokenDoInquerito(db, inq);
    return { token, url: urlInquerito(token) };
  });

  app.post("/v1/turmas/:regime/:id/inqueritos/enviar", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, "O formador não envia inquéritos da turma.")) return;
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    const { regime: r, id } = v.params;
    const out = await enviarInqueritosDaTurma(db, req.actor!.id, r, id);
    if ("erro" in out) return reply.code(out.codigo).send({ error: out.erro });
    await audit(db, req.actor!.id, "inquerito.enviar_turma", "turma", String(id), req.ip, { regime: r, enviados: out.enviados, semEmail: out.semEmail });
    return { ok: true, ...out };
  });

  app.get("/v1/public/inqueritos/:token", { config: { rateLimit: { max: 40, timeWindow: "1 minute" } } }, async (req, reply) => {
    const v = validar(reply, { params: tokenParam }, req);
    if (!v) return;
    const found = await repo.inqueritoPorToken(db, v.params.token);
    if (!found) return reply.code(404).send({ error: "inquérito inexistente ou ligação revogada" });
    const payload = asObj(found.payload);
    return { id: Number(found.id), titulo: String(payload.titulo ?? "Inquérito de satisfação"), perguntas: perguntasDe(payload) };
  });

  app.post("/v1/public/inqueritos/:token/respostas", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (req, reply) => {
    const v = validar(reply, { params: tokenParam, body: respostaSchema }, req);
    if (!v) return;
    const found = await repo.inqueritoPorToken(db, v.params.token);
    if (!found) return reply.code(404).send({ error: "inquérito inexistente" });
    await repo.inserirResposta(db, found.id, v.body);
    return { ok: true };
  });
}
