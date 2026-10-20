/** Cronograma público da turma: publicar (gera o HTML no Drive e marca o dossiê) e leitura pública. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { erroSobreposicao } from "../../conflitos.js";
import { htmlCronograma, sessoesPublicas } from "../../cronogramaPublico.js";
import { sincronizarDespesasFormador } from "../../despesasFormador.js";
import { importarPlanosCurso } from "../../planosCurso.js";
import { storeDriveFile } from "../../driveFicheiros.js";
import { ligarAnexoGerado } from "../../pedagogia/ficheiros.js";
import { definirEstadoManual } from "../../repos/dtp.js";
import { renumerarSessoes, sessoesComDados } from "../../repos/pedagogiaSessoes.js";
import { cronogramaDaTurma, gravarCronograma, marcarCronogramaPublicado, turmaParaCronograma } from "../../repos/pedagogiaTurma.js";
import { lerEntidadePublica } from "../../regrasConfig.js";
import { ERRO_TURMA_FECHADA, turmaFechada } from "../../resultados.js";
import { comIdsUnicos, erroSessoesRemovidas } from "../../sessaoAcesso.js";
import { regimeIdParam, validar } from "../../validacao.js";
import type { Deps } from "../tipos.js";

const publicarSchema = z.object({ sessoes: z.array(z.unknown()).max(500).optional() });

export function registarCronograma(app: FastifyInstance, { db, requireAuth, audit }: Deps) {
  app.post("/v1/turmas/:regime/:id/cronograma/publicar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam, body: publicarSchema }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const novas = v.body.sessoes ? comIdsUnicos(v.body.sessoes) : undefined;
    if (novas && novas.length > 0) {
      if (await turmaFechada(db, regime, id)) return reply.code(409).send({ error: ERRO_TURMA_FECHADA });
      const cruzamento = await erroSobreposicao(db, regime, id, novas);
      if (cruzamento) return reply.code(400).send({ error: cruzamento });
      const removida = erroSessoesRemovidas(novas, await sessoesComDados(db, regime, id), (await cronogramaDaTurma(db, regime, id))?.cronograma);
      if (removida) return reply.code(409).send({ error: removida });
      await db.tx(async q => {
        await gravarCronograma(q, regime, id, novas);
        await renumerarSessoes(q, regime, id);
        // Financiada: as horas de cada formador mudam a sua despesa automática.
        if (regime === "fin") await sincronizarDespesasFormador(q, id);
      });
      await importarPlanosCurso(db, regime, id).catch(() => undefined);
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
    await ligarAnexoGerado(db, regime, id, "cronograma", file);
    await definirEstadoManual(db, regime, id, "cronograma", "ok");
    await audit(db, req.actor!.id, "turma.cronograma_publico", "turma", String(id), req.ip, { regime });
    return { ok: true, url: `/cronograma/${regime}/${id}`, publicadoEm: new Date().toISOString(), ficheiro: file.name };
  });

  app.get("/v1/public/cronograma/:regime/:id", async (req, reply) => {
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const turma = await turmaParaCronograma(db, regime, id);
    const sessoes = sessoesPublicas(turma?.cronograma);
    // Publicado com «Publicar», ou de uma turma activa com sessões (a mesma regra da oferta do site, que já mostra
    // essas turmas). Turmas fechadas ou antigas nunca publicadas não se lêem por id.
    const visivel = turma && (turma.cronograma_publicado_em || (turma.na_oferta && sessoes.length));
    if (!turma || !visivel) return reply.code(404).send({ error: "Este cronograma ainda não está no sítio." });
    return {
      nome: turma.nome,
      curso: turma.curso,
      local: turma.local,
      horario: turma.horario,
      inicio: String(turma.data_inicio ?? "").slice(0, 10),
      formador: turma.formador ?? "",
      sessoes,
      // A «Data de fim» da turma (marcador do cronograma), que pode ir além da última sessão.
      fim: String((Array.isArray(turma.cronograma) ? turma.cronograma : []).find((s: { id?: unknown }) => s?.id === "fim-cronograma")?.data ?? "").slice(0, 10),
      entidade: await lerEntidadePublica(db),
    };
  });
}
