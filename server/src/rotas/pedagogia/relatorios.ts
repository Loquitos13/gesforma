/** Relatórios PDF da turma financiada (final, estatístico, pós-formação e perguntas dos inquéritos) e a listagem de formandos. */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { listagemFormandosFin, listagemFormandosGold } from "../../documentosFin.js";
import { anexarPdfDtp } from "../../pedagogia/ficheiros.js";
import { ITEM_PERGUNTAS, NOME_PERGUNTAS, perguntasEnviadas } from "../../pedagogia/inqueritos.js";
import { dadosRelatorioFinal } from "../../pedagogia/relatorio.js";
import { pdfPerguntasInqueritos, pdfRelatorioFinal, pdfRelatorioInqueritos, type RelatorioFinalDados } from "../../relatorioFinal.js";
import { turmaFechada } from "../../resultados.js";
import { regimeIdParam, validar } from "../../validacao.js";
import type { Db } from "../../db/pool.js";
import type { Deps } from "../tipos.js";
import { enviarPdf, semFormador } from "./comum.js";

type Qual = "final" | "pos" | "estatisticos" | "perguntas";

const publicoQuery = z.object({ publico: z.string().max(20).optional() });

/** Relatório estatístico (formandos + formador) e pós-formação a partir dos mesmos dados. */
export function pdfEstatistico(db: Db, turmaId: number, dados: RelatorioFinalDados) {
  return pdfRelatorioInqueritos(db, turmaId, { ...dados, inqueritos: dados.inqueritos.filter(i => i.publico === "formador" || i.publico === "formando") }, {
    titulo: "Relatórios estatísticos",
    intro: "Médias e contagens das respostas dos inquéritos de formandos e de formador enviados a esta turma.",
  });
}

export function pdfPosFormacao(db: Db, turmaId: number, dados: RelatorioFinalDados) {
  return pdfRelatorioInqueritos(db, turmaId, { ...dados, inqueritos: dados.inqueritos.filter(i => i.publico === "pos") }, {
    titulo: "Relatório pós-formação",
    intro: "Só entram respostas dos inquéritos com público-alvo Pós-formação, e só desta turma.",
  });
}

export function registarRelatorios(app: FastifyInstance, { db, requireAuth, audit }: Deps) {
  async function pdfDaTurmaFin(req: FastifyRequest, reply: FastifyReply, qual: Qual) {
    if (!requireAuth(req, reply) || !semFormador(req, reply, "O formador não gera o relatório da turma.")) return;
    const v = validar(reply, { params: regimeIdParam, query: publicoQuery }, req);
    if (!v) return;
    const { regime, id } = v.params;
    if (regime !== "fin") return reply.code(400).send({ error: "O relatório é da turma financiada." });
    const dados = await dadosRelatorioFinal(db, id);
    if (!dados) return reply.code(404).send({ error: "turma não encontrada" });
    let bytes: Buffer;
    let nome: string;
    let itemId: string;
    if (qual === "perguntas") {
      const publico = v.query.publico ?? "";
      if (publico !== "formador" && publico !== "formando" && publico !== "pos") {
        return reply.code(400).send({ error: "Indique o público-alvo do inquérito." });
      }
      const inqueritos = await perguntasEnviadas(db, id, publico);
      bytes = await pdfPerguntasInqueritos(db, id, { acao: dados.acao, curso: dados.curso, publico, inqueritos });
      nome = NOME_PERGUNTAS[publico] ?? "PerguntasInquerito.pdf";
      itemId = ITEM_PERGUNTAS[publico] ?? "inquerito-formandos";
    } else if (qual === "estatisticos") {
      bytes = await pdfEstatistico(db, id, dados);
      nome = "RelatorioEstatistico.pdf";
      itemId = "relatorios-estatisticos";
    } else if (qual === "pos") {
      bytes = await pdfPosFormacao(db, id, dados);
      nome = "RelatorioPosFormacao.pdf";
      itemId = "relatorio-pos";
    } else {
      bytes = await pdfRelatorioFinal(db, id, dados);
      nome = "RelatorioFinalAccao.pdf";
      itemId = "relatorio";
    }
    // Turma fechada: o dossiê fica com o relatório final do fecho; o gerado agora só se descarrega.
    if (qual !== "final" || !(await turmaFechada(db, "fin", id))) {
      await anexarPdfDtp(db, req.actor!.id, "fin", { id, nome: dados.acao }, itemId, nome, bytes)
        .catch(err => req.log.warn({ err, turma: id, item: itemId }, "PDF não anexado ao dossiê"));
    }
    await audit(db, req.actor!.id, `turma.${qual}`, "turma", String(id), req.ip);
    return enviarPdf(reply, nome, bytes);
  }

  // Listagem de formandos (Visão geral › Formandos), nas duas regiões: a Financiada com os logótipos do rodapé.
  app.get("/v1/turmas/:regime/:id/relatorio-formandos", async (req, reply) => {
    if (!requireAuth(req, reply) || !semFormador(req, reply, "O formador não tira a listagem dos formandos.")) return;
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const doc = regime === "fin" ? await listagemFormandosFin(db, id) : await listagemFormandosGold(db, id);
    if (!doc) return reply.code(404).send({ error: "turma não encontrada" });
    await audit(db, req.actor!.id, "turma.listagem_formandos", "turma", String(id), req.ip, { regime });
    return enviarPdf(reply, doc.nome, doc.bytes);
  });

  app.get("/v1/turmas/:regime/:id/relatorio-final", async (req, reply) => pdfDaTurmaFin(req, reply, "final"));
  app.get("/v1/turmas/:regime/:id/relatorio-estatistico", async (req, reply) => pdfDaTurmaFin(req, reply, "estatisticos"));
  app.get("/v1/turmas/:regime/:id/inqueritos/relatorio", async (req, reply) => pdfDaTurmaFin(req, reply, "pos"));
  app.get("/v1/turmas/:regime/:id/inqueritos/perguntas", async (req, reply) => pdfDaTurmaFin(req, reply, "perguntas"));
}
