/** Inquéritos: lista com taxa de resposta, resultados por turma, respostas, ligação pública e envio à turma. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { respostaSchema, tokenParam } from "../pedagogia/esquemas.js";
import { metricasInquerito, perguntasDe, publicoInquerito, resumirPerguntas } from "../pedagogia/inqueritos.js";
import { enviarInqueritosDaTurma, tokenDoInquerito, urlInquerito } from "../pedagogia/inqueritosEnvio.js";
import { asObj, type Regime } from "../pedagogia/util.js";
import { pode } from "../permissoes/capacidades.js";
import * as repo from "../repos/inqueritos.js";
import { dentroDoLimite } from "../limitePedidos.js";
import { idParam, regime, regimeIdParam, textoQuery, validar } from "../validacao.js";
import { semFormador } from "./pedagogia/comum.js";
import type { Deps } from "./tipos.js";

const listaQuery = z.object({ regime: regime.default("gold") });
const resultadosQuery = z.object({ turma: textoQuery(120), curso: textoQuery(200) });
const publicoQuery = z.object({ turma: z.coerce.number().int().positive().optional().catch(undefined) });

/** Gold e Financiada separadas: cada perfil só vê inquéritos (e respostas) do regime em que trabalha. */
function veRegime(role: string, r: string) {
  return pode(role, r === "fin" ? "fin.ver" : "gold.ver");
}
const SEM_REGIME = { error: "Sem acesso aos registos deste regime." };
const TURMA_INVALIDA = { error: "Esta ligação não corresponde a uma turma a que o inquérito foi enviado." };
const INQUERITO_FECHADO = { error: "Este inquérito já não está a receber respostas." };
const TURMA_COMPLETA = { error: "Esta turma já enviou todas as respostas esperadas para este inquérito." };
const DEMASIADAS = { error: "Demasiadas respostas a partir desta ligação. Tente mais tarde." };

/** Respostas públicas por IP e inquérito, por hora: folga para uma turma inteira responder na mesma rede da sala. */
export const RESPOSTAS_POR_IP = 40;

/** Inquérito marcado como inactivo, encerrado ou arquivado (payload.status/estado; sem estado está activo). */
function inqueritoFechado(payload: Record<string, unknown>) {
  return /inativ|inactiv|encerr|fechad|arquiv/i.test(String(payload.status ?? payload.estado ?? ""));
}

const taxa = (respostas: number, destinatarios: number) => (destinatarios > 0 ? Math.round((Math.min(respostas, destinatarios) / destinatarios) * 100) : null);

function dataCurta(v: string | Date) {
  return (v instanceof Date ? v.toISOString() : String(v)).slice(0, 16).replace("T", " ");
}

export async function registar(app: FastifyInstance, { db, requireAuth, audit }: Deps) {
  /**
   * Resposta com a turma da ligação: a turmaId tem de ser uma das turmas a que o inquérito foi enviado
   * (null = recusar) e o nome gravado passa a ser o da turma. Sem turmaId fica o texto livre (respostas antigas).
   */
  async function respostaComTurma(inq: { id: number; regime: Regime }, body: { turma: string; turmaId?: number; formando: string; respostas: Record<string, unknown> }) {
    if (!body.turmaId) return { ...body, turmaId: null };
    const turma = await repo.turmaDoEnvio(db, inq.id, inq.regime, body.turmaId);
    if (!turma) return null;
    const completa = turma.destinatarios > 0 && turma.respostas >= turma.destinatarios;
    return { ...body, turma: turma.nome, turmaId: Number(turma.id), completa };
  }
  app.get("/v1/inqueritos", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, "O formador não consulta os inquéritos.")) return;
    const v = validar(reply, { query: listaQuery }, req);
    if (!v) return;
    if (!veRegime(req.actor!.role, v.query.regime)) return reply.code(403).send(SEM_REGIME);
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
    if (!veRegime(req.actor!.role, inq.regime)) return reply.code(403).send(SEM_REGIME);
    const porTurma = await repo.resultadosPorTurma(db, inq.id, inq.regime, v.query);
    const filtrado = Boolean(v.query.turma || v.query.curso);
    // Filtrado: as respostas das turmas da tabela (por turma_id; as antigas pelo nome).
    const respostas = await repo.respostasDoInquerito(db, inq.id, filtrado ? {
      turmaIds: porTurma.flatMap(t => (t.turma_id != null ? [Number(t.turma_id)] : [])),
      turmas: porTurma.map(t => t.turma),
    } : {});
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
    const inq = await repo.lerInquerito(db, v.params.id);
    if (!inq) return reply.code(404).send({ error: "inquérito inexistente" });
    if (!veRegime(req.actor!.role, inq.regime)) return reply.code(403).send(SEM_REGIME);
    const rows = await repo.respostasDoInquerito(db, v.params.id, { limite: 200 });
    const respostas = rows.map(r => ({ id: Number(r.id), turma: r.turma, formando: r.formando, respostas: asObj(r.respostas), data: dataCurta(r.created_at) }));
    return { respostas, metricas: metricasInquerito(perguntasDe(asObj(inq.payload)), respostas.map(r => r.respostas)) };
  });

  app.post("/v1/inqueritos/:id/respostas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: respostaSchema }, req);
    if (!v) return;
    const inq = await repo.lerInquerito(db, v.params.id);
    if (!inq) return reply.code(404).send({ error: "inquérito inexistente" });
    if (!veRegime(req.actor!.role, inq.regime)) return reply.code(403).send(SEM_REGIME);
    const resposta = await respostaComTurma(inq, v.body);
    if (!resposta) return reply.code(400).send(TURMA_INVALIDA);
    await repo.inserirResposta(db, v.params.id, resposta);
    await audit(db, req.actor!.id, "inquerito.resposta", "inquerito", String(v.params.id), req.ip);
    return { ok: true };
  });

  app.get("/v1/inqueritos/:id/publico", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const inq = await repo.lerInquerito(db, v.params.id);
    if (!inq) return reply.code(404).send({ error: "inquérito inexistente" });
    if (!veRegime(req.actor!.role, inq.regime)) return reply.code(403).send(SEM_REGIME);
    const token = await tokenDoInquerito(db, inq);
    return { token, url: urlInquerito(token) };
  });

  app.post("/v1/turmas/:regime/:id/inqueritos/enviar", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, "O formador não envia inquéritos da turma.")) return;
    const v = validar(reply, { params: regimeIdParam, query: z.object({ fase: z.enum(["fim", "pos"]).optional() }) }, req);
    if (!v) return;
    const { regime: r, id } = v.params;
    const fase = v.query.fase ?? "fim";
    const out = await enviarInqueritosDaTurma(db, req.actor!.id, r, id, fase);
    if ("erro" in out) return reply.code(out.codigo).send({ error: out.erro });
    await audit(db, req.actor!.id, "inquerito.enviar_turma", "turma", String(id), req.ip, { regime: r, fase, enviados: out.enviados, semEmail: out.semEmail });
    return { ok: true, ...out };
  });

  app.get("/v1/public/inqueritos/:token", { config: { rateLimit: { max: 40, timeWindow: "1 minute" } } }, async (req, reply) => {
    const v = validar(reply, { params: tokenParam, query: publicoQuery }, req);
    if (!v) return;
    const found = await repo.inqueritoPorToken(db, v.params.token);
    if (!found) return reply.code(404).send({ error: "inquérito inexistente ou ligação revogada" });
    const payload = asObj(found.payload);
    if (inqueritoFechado(payload)) return reply.code(410).send(INQUERITO_FECHADO);
    // A turma da ligação só conta se o inquérito lhe foi enviado; senão o formulário pede-a por extenso.
    const turma = v.query.turma ? await repo.turmaDoEnvio(db, found.id, found.regime, v.query.turma) : null;
    return {
      id: Number(found.id),
      titulo: String(payload.titulo ?? "Inquérito de satisfação"),
      perguntas: perguntasDe(payload),
      turma: turma ? { id: Number(turma.id), nome: turma.nome } : null,
    };
  });

  app.post("/v1/public/inqueritos/:token/respostas", { config: { rateLimit: { max: 8, timeWindow: "1 minute" } } }, async (req, reply) => {
    const v = validar(reply, { params: tokenParam, body: respostaSchema }, req);
    if (!v) return;
    const found = await repo.inqueritoPorToken(db, v.params.token);
    if (!found) return reply.code(404).send({ error: "inquérito inexistente" });
    if (inqueritoFechado(asObj(found.payload))) return reply.code(410).send(INQUERITO_FECHADO);
    const resposta = await respostaComTurma(found, v.body);
    if (!resposta) return reply.code(400).send(TURMA_INVALIDA);
    // Com a turma da ligação, nunca mais respostas do que os destinatários do envio; sempre, um tecto por IP (na base de dados).
    if ("completa" in resposta && resposta.completa) return reply.code(409).send(TURMA_COMPLETA);
    if (!(await dentroDoLimite(db, "inquerito-ip", `${found.id}:${req.ip}`, RESPOSTAS_POR_IP, 3600))) {
      return reply.code(429).send(DEMASIADAS);
    }
    await repo.inserirResposta(db, found.id, resposta);
    return { ok: true };
  });
}
