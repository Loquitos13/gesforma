/** Pedagogia da turma: leitura geral, sessões (plano, sumário, presenças) e documentos. */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { dtpForTurma } from "../../pedagogia/dtp.js";
import { importarDeTurma, importarPlanosCurso, ordensComPlanoDoCurso } from "../../planosCurso.js";
import { turmasDoMesmoCurso } from "../../repos/planosCurso.js";
import { documentoSchema, sessaoParam, sessaoPatchSchema } from "../../pedagogia/esquemas.js";
import { asArr, asObj } from "../../pedagogia/util.js";
import {
  gravarDocumento, gravarSessao, lerSessao, listarCertificados, listarDocumentos, listarSessoes,
} from "../../repos/pedagogiaSessoes.js";
import { carregarTurma, cronogramaDaTurma, cronogramaParaGravar, formandosDaTurma } from "../../repos/pedagogiaTurma.js";
import { ERRO_TURMA_FECHADA, turmaFechada } from "../../resultados.js";
import { podeGravarSessao, sessaoLectivaN, sessaoLectivaPorId } from "../../sessaoAcesso.js";
import { planoComRegras, podeValidarPresencas, sumarioComRegras } from "../../sessaoRegras.js";
import { avisarPlanoRevisto } from "../../planoAviso.js";
import { documentosSessoesDaTurma, NOMES_DOCUMENTOS_FIN } from "../../documentosFin.js";
import { regimeIdParam, validar } from "../../validacao.js";
import type { Deps } from "../tipos.js";
import { enviarPdf, formadorPodeVer, turmaOu404 } from "./comum.js";

// Sem origem: da ficha do curso. Com origem: de outra turma do mesmo curso (turma padrão), planos e sumários.
/** Só a sessão n (1…), ou todas as sessões lectivas. */
const sessaoQuery = z.object({ sessao: z.coerce.number().int().positive().max(2000).optional() });

const importarPlanosSchema = z.object({ substituir: z.boolean().optional().default(false), origemTurmaId: z.number().int().positive().optional() });

function sessaoDTO(n: number, r: { plano: unknown; sumario: unknown; presencas: unknown; folha?: unknown } | null | undefined, sessaoId: string | null) {
  return {
    n,
    sessaoId,
    plano: r?.plano ? asObj(r.plano) : null,
    sumario: r?.sumario ? asObj(r.sumario) : null,
    presencas: asArr(r?.presencas),
    /** Horas teóricas / práticas e quem validou as presenças. */
    folha: r?.folha ? asObj(r.folha) : null,
  };
}

function formadoresDaSessao(s: { formadores?: string[]; formador?: string }) {
  return Array.isArray(s.formadores) && s.formadores.length ? s.formadores.map(String) : s.formador ? [s.formador] : [];
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
    // O formador fica fora do dossiê (FORMADOR_SEM_LEITURA): não recebe o DTP nem as ligações dos anexos.
    const formador = req.actor!.role === "formador";
    const [sessoes, documentos, certificados, dtp, planosDoCurso] = await Promise.all([
      listarSessoes(db, regime, id),
      listarDocumentos(db, regime, id),
      listarCertificados(db, regime, id),
      formador ? null : dtpForTurma(db, regime, turma),
      ordensComPlanoDoCurso(db, regime, id),
    ]);
    return {
      /** Sessões (n) com plano definido na ficha do curso: só leitura para o formador. */
      planosDoCurso: [...planosDoCurso].sort((a, b) => a - b),
      sessoes: sessoes.map(r => sessaoDTO(r.sessao_n, r, r.sessao_id)),
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
      ...(dtp ? { dtp } : {}),
    };
  });

  /**
   * Folhas de presenças / sumário e planos de sessão da Financiada, no modelo da candidatura (para imprimir no cockpit).
   * O formador só os tira das turmas em que está atribuído; não ficam no dossiê (isso é o «Gerar» do Dossiê TP).
   */
  for (const [caminho, doc] of [["folhas-presenca", "folhas"], ["planos-sessao", "planos"]] as const) {
    app.get(`/v1/turmas/:regime/:id/${caminho}`, async (req, reply) => {
      if (!requireAuth(req, reply)) return;
      const v = validar(reply, { params: regimeIdParam, query: sessaoQuery }, req);
      if (!v) return;
      const { regime, id } = v.params;
      if (regime !== "fin") return reply.code(400).send({ error: "Este documento é da turma financiada." });
      if (!(await formadorPodeVer(db, req, reply, regime, id, "Só consulta as turmas em que está atribuído."))) return;
      const docs = await documentosSessoesDaTurma(db, id, { n: v.query.sessao, so: doc });
      if (!docs) return reply.code(404).send({ error: v.query.sessao ? "sessão não encontrada" : "turma não encontrada" });
      const base = NOMES_DOCUMENTOS_FIN[doc].replace(/\.pdf$/, "");
      const nome = v.query.sessao ? `${base} - sessao ${v.query.sessao}.pdf` : `${base}.pdf`;
      await audit(db, req.actor!.id, "turma.documento_pdf", "turma", String(id), req.ip, { doc, sessao: v.query.sessao ?? null });
      return enviarPdf(reply, nome, doc === "folhas" ? docs.folhas : docs.planos);
    });
  }

  app.put("/v1/turmas/:regime/:id/sessoes/:n", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: sessaoParam, body: sessaoPatchSchema }, req);
    if (!v) return;
    const { regime, id, n } = v.params;
    const { sessaoId: idPedido, validarPresencas, assinarFolha, folha: folhaPedida, ...patch } = v.body;
    const folha: Record<string, unknown> | undefined = folhaPedida ? { ...folhaPedida } : undefined;
    const staff = podeValidarPresencas(req.actor!.role);
    if (validarPresencas !== undefined && !staff) {
      return reply.code(403).send({ error: "Só a coordenação pedagógica valida a folha de presenças." });
    }
    if (assinarFolha && req.actor!.role !== "formador") {
      return reply.code(403).send({ error: "A folha de presenças é assinada pelo formador da sessão." });
    }
    if (await turmaFechada(db, regime, id)) return reply.code(409).send({ error: ERRO_TURMA_FECHADA });
    const turmaRow = await cronogramaDaTurma(db, regime, id);
    if (!turmaRow) return reply.code(404).send({ error: "turma não encontrada" });
    // A verdade é o id da sessão; o n do caminho só serve a clientes que não o enviam.
    const sessaoId = idPedido ?? String(sessaoLectivaN(turmaRow.cronograma, n)?.id ?? "");
    const alvo = sessaoLectivaPorId(turmaRow.cronograma, sessaoId);
    if (!alvo) return reply.code(404).send({ error: `A sessão ${idPedido ? "" : `${n} `}não existe no cronograma da turma.` });
    const acesso = await podeGravarSessao(db, req.actor!, {
      regime, turmaId: id, sessaoId, cronograma: turmaRow.cronograma, plano: patch.plano, sumario: patch.sumario,
      // Horas T / P fazem parte da folha de presenças: depois de validada, só a coordenação as muda.
      presencas: patch.presencas ?? (folha || assinarFolha ? [] : undefined),
    });
    if (!acesso.ok) return reply.code(403).send({ error: acesso.erro });
    if (patch.plano && req.actor!.role === "formador" && (await ordensComPlanoDoCurso(db, regime, id)).has(alvo.n)) {
      return reply.code(403).send({ error: "O plano desta sessão está definido na ficha do curso: o formador consulta-o mas não o altera." });
    }
    if (patch.presencas?.length) {
      const turma = await turmaOu404(db, reply, regime, id);
      if (!turma) return;
      const daTurma = new Set((await formandosDaTurma(db, regime, turma)).map(f => f.id));
      if (patch.presencas.some(p => !daTurma.has(p.id))) {
        return reply.code(400).send({ error: "A folha de presenças tem formandos que não pertencem a esta turma." });
      }
    }
    const antes = patch.plano || patch.sumario || validarPresencas !== undefined ? await lerSessao(db, regime, id, sessaoId) : null;
    let revisto: "aprovado" | "devolvido" | null = null;
    let folhaGravar: Record<string, unknown> | undefined;
    if (patch.plano) {
      const regra = planoComRegras(req.actor!.role, req.actor!.name, antes?.plano ? asObj(antes.plano) : null, patch.plano);
      if (!regra.ok) return reply.code(regra.codigo).send({ error: regra.erro });
      patch.plano = regra.plano as typeof patch.plano;
      revisto = regra.revisto;
    }
    if (validarPresencas !== undefined) {
      // A validação vive no sumário (o fecho e o dossiê lêem-na daí); a Financiada não tem sumário e fica só com ela.
      const sumarioAntes = antes?.sumario ? asObj(antes.sumario) : {};
      patch.sumario = {
        conteudos: "", atividades: "", observacoes: "", assinado: false, ...sumarioAntes,
        ...(patch.sumario ?? {}), presencasValidadas: validarPresencas,
      } as typeof patch.sumario;
      const marca = validarPresencas ? { validadaPor: req.actor!.name, validadaEm: new Date().toISOString() } : { validadaPor: null, validadaEm: null };
      folhaGravar = { ...(folha ?? {}), ...marca };
    } else if (folha) {
      folhaGravar = folha;
    }
    if (req.actor!.role === "formador" && (assinarFolha || patch.presencas || folha)) {
      // Assinar fica com o nome da conta e a hora do servidor; alterar a folha depois de assinada tira a assinatura.
      const marca = assinarFolha
        ? { assinadaPor: req.actor!.name, assinadaEm: new Date().toISOString() }
        : { assinadaPor: null, assinadaEm: null };
      folhaGravar = { ...(folhaGravar ?? {}), ...marca };
    }
    if (patch.sumario) {
      const regra = sumarioComRegras(req.actor!.role, antes?.sumario ? asObj(antes.sumario) : null, patch.sumario!, String(alvo.sessao.data ?? ""));
      if (!regra.ok) return reply.code(409).send({ error: regra.erro });
      patch.sumario = regra.sumario;
    }
    // Com o cronograma bloqueado: a sessão ainda existe e grava-se com a posição de agora.
    const gravada = await db.tx(async q => {
      const agora = sessaoLectivaPorId((await cronogramaParaGravar(q, regime, id))?.cronograma, sessaoId);
      if (agora) await gravarSessao(q, regime, id, { id: sessaoId, n: agora.n }, { ...patch, folha: folhaGravar });
      return agora;
    });
    if (!gravada) return reply.code(409).send({ error: "A sessão saiu do cronograma entretanto. Recarregue a turma." });
    const acao = revisto ? `turma.plano_${revisto}` : patch.plano ? "turma.plano" : validarPresencas !== undefined ? "turma.presencas_validar"
      : assinarFolha ? "turma.presencas_assinar"
      : patch.sumario ? "turma.sumario" : "turma.presencas";
    await audit(db, req.actor!.id, acao, "turma", String(id), req.ip, { regime, sessao: gravada.n, sessaoId });
    if (revisto) {
      // O email não pode desfazer a gravação: falhando, fica no registo.
      const turma = await carregarTurma(db, regime, id);
      const plano = patch.plano as { comentario?: string } | undefined;
      if (turma) {
        await avisarPlanoRevisto(db, {
          regime, turmaId: id, turma: turma.nome, curso: turma.curso, n: gravada.n, data: String(alvo.sessao.data ?? ""),
          formadores: formadoresDaSessao(alvo.sessao), estado: revisto, comentario: String(plano?.comentario ?? ""), revistoPor: req.actor!.name,
        }).catch(err => req.log.warn({ err }, "aviso do plano de sessão ao formador falhou"));
      }
    }
    return { sessao: sessaoDTO(gravada.n, await lerSessao(db, regime, id, sessaoId), sessaoId) };
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
    const origem = v.body.origemTurmaId;
    if (origem && !(await turmasDoMesmoCurso(db, regime, id)).some(t => Number(t.id) === origem)) {
      return reply.code(400).send({ error: "Só se copia de outra turma do mesmo curso." });
    }
    const r = origem
      ? await importarDeTurma(db, regime, id, origem, { substituir: v.body.substituir })
      : await importarPlanosCurso(db, regime, id, { substituir: v.body.substituir });
    await audit(db, req.actor!.id, "turma.planos_importar", "turma", String(id), req.ip, { regime, ...r });
    return r;
  });

  /** Turmas do mesmo curso de onde se podem copiar planos e sumários. */
  app.get("/v1/turmas/:regime/:id/planos/origens", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    return { turmas: (await turmasDoMesmoCurso(db, v.params.regime, v.params.id)).map(t => ({ id: Number(t.id), nome: t.nome, dataInicio: String(t.data_inicio ?? "").slice(0, 10) })) };
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
