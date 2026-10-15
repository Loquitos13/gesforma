/** Pedagogia da turma: leitura geral, sessões (plano, sumário, presenças) e documentos. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { dtpForTurma } from "../../pedagogia/dtp.js";
import { importarPlanosCurso } from "../../planosCurso.js";
import { documentoSchema, sessaoParam, sessaoPatchSchema } from "../../pedagogia/esquemas.js";
import { asArr, asObj } from "../../pedagogia/util.js";
import {
  gravarDocumento, gravarSessao, lerSessao, listarCertificados, listarDocumentos, listarSessoes,
} from "../../repos/pedagogiaSessoes.js";
import { cronogramaDaTurma, formandosDaTurma } from "../../repos/pedagogiaTurma.js";
import { ERRO_TURMA_FECHADA, turmaFechada } from "../../resultados.js";
import { podeGravarSessao, sessaoLectivaN } from "../../sessaoAcesso.js";
import { sumarioComRegras } from "../../sessaoRegras.js";
import { regimeIdParam, validar } from "../../validacao.js";
import type { Deps } from "../tipos.js";
import { formadorPodeVer, turmaOu404 } from "./comum.js";

const importarPlanosSchema = z.object({ substituir: z.boolean().optional().default(false) });

function sessaoDTO(n: number, r: { plano: unknown; sumario: unknown; presencas: unknown } | null | undefined) {
  return {
    n,
    plano: r?.plano ? asObj(r.plano) : null,
    sumario: r?.sumario ? asObj(r.sumario) : null,
    presencas: asArr(r?.presencas),
  };
}

export function registarSessoes(app: FastifyInstance, { db, requireAuth, audit }: Deps) {
  app.get("/v1/turmas/:regime/:id/pedagogia", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    const { regime, id } = v.params;
    if (!(await formadorPodeVer(db, req, reply, regime, id, "Só consulta as turmas em que está atribuído."))) return;
    const turma = await turmaOu404(db, reply, regime, id);
    if (!turma) return;
    const [sessoes, documentos, certificados, dtp] = await Promise.all([
      listarSessoes(db, regime, id),
      listarDocumentos(db, regime, id),
      listarCertificados(db, regime, id),
      dtpForTurma(db, regime, turma),
    ]);
    return {
      sessoes: sessoes.map(r => sessaoDTO(r.sessao_n, r)),
      documentos: documentos.map(r => ({ grupoId: r.grupo_id, label: r.label, estado: r.estado, detalhe: r.detalhe, payload: r.payload ?? null })),
      certificados: certificados.map(r => ({
        formandoId: r.formando_id,
        emitido: r.emitido || Boolean(r.ficheiro_id),
        nota: r.nota == null ? null : Number(r.nota),
        elearning: r.elearning == null ? null : Number(r.elearning),
        ficheiroId: r.ficheiro_id,
        ficheiroNome: r.ficheiro_nome,
        ficheiroUrl: r.ficheiro_url,
      })),
      dtp,
    };
  });

  app.put("/v1/turmas/:regime/:id/sessoes/:n", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: sessaoParam, body: sessaoPatchSchema }, req);
    if (!v) return;
    const { regime, id, n } = v.params;
    const patch = v.body;
    if (await turmaFechada(db, regime, id)) return reply.code(409).send({ error: ERRO_TURMA_FECHADA });
    const acesso = await podeGravarSessao(db, req.actor!, { regime, turmaId: id, n, plano: patch.plano, sumario: patch.sumario, presencas: patch.presencas });
    if (!acesso.ok) return reply.code(403).send({ error: acesso.erro });
    if (patch.presencas?.length) {
      const turma = await turmaOu404(db, reply, regime, id);
      if (!turma) return;
      const daTurma = new Set((await formandosDaTurma(db, regime, turma)).map(f => f.id));
      if (patch.presencas.some(p => !daTurma.has(p.id))) {
        return reply.code(400).send({ error: "A folha de presenças tem formandos que não pertencem a esta turma." });
      }
    }
    if (patch.sumario) {
      const [turmaRow, antes] = await Promise.all([cronogramaDaTurma(db, regime, id), lerSessao(db, regime, id, n)]);
      const dataSessao = String(sessaoLectivaN(turmaRow?.cronograma, n)?.data ?? "");
      const regra = sumarioComRegras(req.actor!.role, antes?.sumario ? asObj(antes.sumario) : null, patch.sumario, dataSessao);
      if (!regra.ok) return reply.code(409).send({ error: regra.erro });
      patch.sumario = regra.sumario;
    }
    await gravarSessao(db, regime, id, n, patch);
    const acao = patch.plano ? "turma.plano" : patch.sumario ? "turma.sumario" : "turma.presencas";
    await audit(db, req.actor!.id, acao, "turma", String(id), req.ip, { regime, sessao: n });
    return { sessao: sessaoDTO(n, await lerSessao(db, regime, id, n)) };
  });

  /** Copia os planos de sessão da ficha do curso para as sessões da turma (com `substituir`, também as não assinadas). */
  app.post("/v1/turmas/:regime/:id/planos/importar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam, body: importarPlanosSchema }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const turma = await turmaOu404(db, reply, regime, id);
    if (!turma) return;
    if (await turmaFechada(db, regime, id)) return reply.code(409).send({ error: ERRO_TURMA_FECHADA });
    const r = await importarPlanosCurso(db, regime, id, { substituir: v.body.substituir });
    await audit(db, req.actor!.id, "turma.planos_importar", "turma", String(id), req.ip, { regime, ...r });
    return r;
  });

  app.put("/v1/turmas/:regime/:id/documentos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam, body: documentoSchema }, req);
    if (!v) return;
    const { regime, id } = v.params;
    if (await turmaFechada(db, regime, id)) return reply.code(409).send({ error: ERRO_TURMA_FECHADA });
    await gravarDocumento(db, regime, id, v.body);
    await audit(db, req.actor!.id, "turma.documento", "turma", String(id), req.ip, { regime, label: v.body.label, estado: v.body.estado });
    return { ok: true };
  });
}
