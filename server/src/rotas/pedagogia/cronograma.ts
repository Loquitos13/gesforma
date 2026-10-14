/** Cronograma público da turma: publicar (gera o HTML no Drive e marca o dossiê) e leitura pública. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { erroSobreposicao } from "../../conflitos.js";
import { htmlCronograma, sessoesPublicas } from "../../cronogramaPublico.js";
import { storeDriveFile } from "../../driveFicheiros.js";
import { definirEstadoManual, gravarAnexo } from "../../repos/dtp.js";
import { gravarCronograma, marcarCronogramaPublicado, turmaParaCronograma } from "../../repos/pedagogiaTurma.js";
import { lerEntidadePublica } from "../../regrasConfig.js";
import { ERRO_TURMA_FECHADA, turmaFechada } from "../../resultados.js";
import { regimeIdParam, validar } from "../../validacao.js";
import type { Deps } from "../tipos.js";

const publicarSchema = z.object({ sessoes: z.array(z.unknown()).max(500).optional() });

export function registarCronograma(app: FastifyInstance, { db, requireAuth, audit }: Deps) {
  app.post("/v1/turmas/:regime/:id/cronograma/publicar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam, body: publicarSchema }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const novas = v.body.sessoes;
    if (novas && novas.length > 0) {
      if (await turmaFechada(db, regime, id)) return reply.code(409).send({ error: ERRO_TURMA_FECHADA });
      const cruzamento = await erroSobreposicao(db, regime, id, novas);
      if (cruzamento) return reply.code(400).send({ error: cruzamento });
      await gravarCronograma(db, regime, id, novas);
    }
    const turma = await turmaParaCronograma(db, regime, id);
    if (!turma) return reply.code(404).send({ error: "turma não encontrada" });
    const sessoes = sessoesPublicas(turma.cronograma);
    if (!sessoes.length) return reply.code(400).send({ error: "O cronograma ainda não tem sessões." });
    const html = htmlCronograma({
      nome: turma.nome,
      curso: turma.curso,
      local: turma.local,
      horario: turma.horario,
      inicio: String(turma.data_inicio ?? "").slice(0, 10),
      formador: turma.formador,
      sessoes,
    });
    const file = await storeDriveFile(db, req.actor!.id, {
      name: "Cronograma.html",
      mime: "text/html",
      bytes: Buffer.from(html, "utf8"),
    }, { kind: "dtp", regime, turma: turma.nome, label: "cronograma", itemId: "cronograma" }, { gerado: true });
    await marcarCronogramaPublicado(db, regime, id);
    await gravarAnexo(db, regime, id, "cronograma", { id: file.id, nome: file.name, url: file.openUrl ?? "" });
    await definirEstadoManual(db, regime, id, "cronograma", "ok");
    await audit(db, req.actor!.id, "turma.cronograma_publico", "turma", String(id), req.ip, { regime });
    return { ok: true, url: `/cronograma/${regime}/${id}`, publicadoEm: new Date().toISOString(), ficheiro: file.name };
  });

  app.get("/v1/public/cronograma/:regime/:id", async (req, reply) => {
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const turma = await turmaParaCronograma(db, regime, id);
    if (!turma?.cronograma_publicado_em) return reply.code(404).send({ error: "Este cronograma ainda não está no sítio." });
    return {
      nome: turma.nome,
      curso: turma.curso,
      local: turma.local,
      horario: turma.horario,
      inicio: String(turma.data_inicio ?? "").slice(0, 10),
      formador: turma.formador ?? "",
      sessoes: sessoesPublicas(turma.cronograma),
      entidade: await lerEntidadePublica(db),
    };
  });
}
