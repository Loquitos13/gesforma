/**
 * Reembolso da turma da Financiada: o ficheiro de execução física e o de despesas (um de cada por turma).
 * Permissões: as da turma da Financiada (`/v1/turmas-fin*`: administração, secretaria e Financiada).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { anexoXlsx, estadoReembolso, gerarFicheiroReembolso, MIME_XLSX, sincronizarReembolso, TIPOS_REEMBOLSO } from "../reembolso.js";
import type { TipoReembolso } from "../repos/reembolso.js";
import { idNum, idParam, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const tipoParam = z.object({ id: idNum, tipo: z.enum(["execucao-fisica", "despesas"]) });
const corpoActualizar = z.object({ forcar: z.boolean().optional() }).optional();

export async function registar(app: FastifyInstance, { db, requireAuth, audit }: Deps) {
  app.get("/v1/turmas-fin/:id/reembolso", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const estado = await estadoReembolso(db, v.params.id);
    if (!estado) return reply.code(404).send({ error: "Turma não encontrada." });
    return estado;
  });

  /** Gera os dois ficheiros com os dados actuais e actualiza na Drive os que mudaram (ou todos, com `forcar`). */
  app.post("/v1/turmas-fin/:id/reembolso/atualizar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: corpoActualizar }, req);
    if (!v) return;
    const { id } = v.params;
    const erros: Partial<Record<TipoReembolso, string>> = {};
    for (const tipo of TIPOS_REEMBOLSO) {
      try {
        const r = await sincronizarReembolso(db, req.actor!.id, id, tipo, { forcar: v.body?.forcar });
        if (!r) return reply.code(404).send({ error: "Turma não encontrada." });
      } catch (err) {
        erros[tipo] = err instanceof Error ? err.message : "Não foi possível guardar na Drive.";
      }
    }
    await audit(db, req.actor!.id, "turma.reembolso_atualizar", "turma_fin", String(id), req.ip, { erros: Object.keys(erros) });
    return { ...(await estadoReembolso(db, id)), erros };
  });

  /** Descarrega o ficheiro, sempre gerado agora; a cópia da Drive actualiza-se se estava desactualizada. */
  app.get("/v1/turmas-fin/:id/reembolso/:tipo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: tipoParam }, req);
    if (!v) return;
    const { id, tipo } = v.params;
    const g = await gerarFicheiroReembolso(db, id, tipo);
    if (!g) return reply.code(404).send({ error: "Turma não encontrada." });
    const bytes = g.bytes();
    await sincronizarReembolso(db, req.actor!.id, id, tipo, { gerado: { ...g, bytes: () => bytes } })
      .catch(err => req.log.warn({ err, turma: id, tipo }, "ficheiro do reembolso não actualizado na Drive"));
    await audit(db, req.actor!.id, "turma.reembolso_descarregar", "turma_fin", String(id), req.ip, { tipo });
    reply
      .header("content-type", MIME_XLSX)
      .header("content-disposition", anexoXlsx(g.nome))
      .header("cache-control", "no-store");
    return reply.send(bytes);
  });
}
