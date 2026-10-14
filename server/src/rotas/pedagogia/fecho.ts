/** Fecho formal da turma (Gold e Financiada) e reabertura pelo administrador. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { dtpEmFalta } from "../../pedagogia/dtp.js";
import { anexarPdfDtp } from "../../pedagogia/ficheiros.js";
import { dadosRelatorioFinal } from "../../pedagogia/relatorio.js";
import { pdfRelatorioFinal } from "../../relatorioFinal.js";
import { estadoFechoFin, fecharTurmaFin, fecharTurmaGold, reabrirTurma } from "../../repos/pedagogiaTurma.js";
import { pendentesDoFecho, turmaFechada } from "../../resultados.js";
import { idParam, regimeIdParam, validar } from "../../validacao.js";
import type { Deps } from "../tipos.js";
import { semFormador, turmaOu404 } from "./comum.js";

const motivoSchema = z.object({ motivo: z.string().trim().max(500).default("") });

export function registarFecho(app: FastifyInstance, { db, requireAuth, audit }: Deps) {
  app.post("/v1/turmas/fin/:id/fecho", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, "O formador não fecha a turma.")) return;
    const role = req.actor!.role;
    if (role !== "admin" && role !== "secretaria" && role !== "financiada") {
      return reply.code(403).send({ error: "Só a equipa pedagógica fecha a turma." });
    }
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const { id } = v.params;
    const antes = await estadoFechoFin(db, id);
    if (!antes) return reply.code(404).send({ error: "turma não encontrada" });
    if (antes.fechada_em) return reply.code(409).send({ error: "Esta turma já foi fechada formalmente." });
    const turma = await turmaOu404(db, reply, "fin", id);
    if (!turma) return;
    const pend = await pendentesDoFecho(db, "fin", id, { dtpEmFalta: () => dtpEmFalta(db, "fin", turma) });
    if (pend && pend.falta.length) return reply.code(409).send({ error: "A turma ainda não pode ser fechada.", falta: pend.falta });
    const dados = await dadosRelatorioFinal(db, id);
    if (!dados) return reply.code(404).send({ error: "turma não encontrada" });
    const bytes = pdfRelatorioFinal(dados);
    const resumo = {
      acao: dados.acao,
      curso: dados.curso,
      formandos: dados.formandos.length,
      horas: dados.duracaoHoras,
      geradoEm: new Date().toISOString(),
    };
    await fecharTurmaFin(db, id, req.actor!.id, resumo);
    await anexarPdfDtp(db, req.actor!.id, "fin", { id, nome: antes.nome }, "relatorio", "RelatorioFinalAccao.pdf", bytes).catch(() => undefined);
    await audit(db, req.actor!.id, "turma.fecho", "turma_fin", String(id), req.ip, resumo);
    return { ok: true, resumo, relatorioUrl: `/v1/turmas/fin/${id}/relatorio-final` };
  });

  app.post("/v1/turmas/gold/:id/fecho", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const { id } = v.params;
    const turma = await turmaOu404(db, reply, "gold", id);
    if (!turma) return;
    if (await turmaFechada(db, "gold", id)) return reply.code(409).send({ error: "Esta turma já foi fechada formalmente." });
    const pend = await pendentesDoFecho(db, "gold", id, { dtpEmFalta: () => dtpEmFalta(db, "gold", turma) });
    if (pend && pend.falta.length) return reply.code(409).send({ error: "A turma ainda não pode ser fechada.", falta: pend.falta });
    const resumo = {
      acao: turma.nome,
      curso: turma.curso,
      formandos: pend?.resultados.resumo.total ?? 0,
      elegiveis: pend?.resultados.resumo.elegiveis ?? 0,
      geradoEm: new Date().toISOString(),
    };
    await fecharTurmaGold(db, id, req.actor!.id);
    await audit(db, req.actor!.id, "turma.fecho", "turma_gold", String(id), req.ip, resumo);
    return { ok: true, resumo };
  });

  app.post("/v1/turmas/:regime/:id/reabrir", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor!.role !== "admin") return reply.code(403).send({ error: "Só o administrador reabre uma turma fechada." });
    const v = validar(reply, { params: regimeIdParam, body: motivoSchema }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const motivo = v.body.motivo;
    if (!motivo) return reply.code(400).send({ error: "Indique o motivo da reabertura." });
    if (!(await turmaFechada(db, regime, id))) return reply.code(409).send({ error: "A turma não está fechada." });
    await reabrirTurma(db, regime, id);
    await audit(db, req.actor!.id, "turma.reabrir", `turma_${regime}`, String(id), req.ip, { motivo });
    return { ok: true };
  });
}
