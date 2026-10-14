/** Ajudantes partilhados pelas rotas da pedagogia da turma. */
import type { FastifyReply, FastifyRequest } from "fastify";
import type { Db } from "../../db/pool.js";
import { carregarTurma, type TurmaRow } from "../../repos/pedagogiaTurma.js";
import { formadorNaTurma } from "../../sessaoAcesso.js";
import type { Regime } from "../../pedagogia/util.js";

/** Carrega a turma ou responde 404. */
export async function turmaOu404(db: Db, reply: FastifyReply, regime: Regime, id: number): Promise<TurmaRow | null> {
  const turma = await carregarTurma(db, regime, id);
  if (!turma) {
    reply.code(404).send({ error: "turma não encontrada" });
    return null;
  }
  return turma;
}

/** O formador só consulta as turmas em que está atribuído; a equipa passa sempre. */
export async function formadorPodeVer(db: Db, req: FastifyRequest, reply: FastifyReply, regime: Regime, id: number, erro: string) {
  if (await formadorNaTurma(db, req.actor!, regime, id)) return true;
  reply.code(403).send({ error: erro });
  return false;
}

export function semFormador(req: FastifyRequest, reply: FastifyReply, erro: string) {
  if (req.actor!.role !== "formador") return true;
  reply.code(403).send({ error: erro });
  return false;
}

/** PDF como anexo. */
export function enviarPdf(reply: FastifyReply, nome: string, bytes: Buffer) {
  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `attachment; filename="${nome}"`)
    .send(bytes);
}
