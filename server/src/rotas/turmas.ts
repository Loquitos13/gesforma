/**
 * Turmas Gold e Financiada: lista (GET /v1/turmas), criar, alterar, apagar e regras de abertura automática.
 * O SQL está em repos/turmas.ts; aqui só se valida, verifica o perfil e chama os serviços.
 */
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { generateCronograma } from "../cronograma.js";
import { importarPlanosCurso } from "../planosCurso.js";
import { erroSobreposicao } from "../conflitos.js";
import { docsBase } from "../docsCurso.js";
import { limparAtalhosDaTurma } from "../driveArvore.js";
import { normalizarEstado, validarTransicao } from "../estados.js";
import { erroDisponibilidade } from "../formadorConta.js";
import { syncTurmaDriveAccess } from "../driveArvore.js";
import { bloqueioTurma, propagarCursoDaTurma, propagarNomeTurma } from "../ligacoes.js";
import { mapTurmaFin, mapTurmaGold, nextOpsId } from "../ops.js";
import { pode } from "../permissoes/capacidades.js";
import { modulosDaFicha } from "../programaCurso.js";
import { ERRO_TURMA_FECHADA } from "../resultados.js";
import { comIdsUnicos, erroSessoesRemovidas, nomesDoFormador } from "../sessaoAcesso.js";
import { renumerarSessoes, sessoesComDados } from "../repos/pedagogiaSessoes.js";
import { aplicarTurmaRegras, listTurmaRegras } from "../turmaRegras.js";
import * as repo from "../repos/turmas.js";
import type { Regime } from "../repos/sql.js";
import { idParam, paginacao, periodoQuery, regime as regimeSchema, textoQuery, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";
import { hojeLisboa } from "../datas.js";

/** Hoje em Lisboa (o painel usa o mesmo dia para a fase «a decorrer»), seja qual for o fuso do processo. */
export function hojeIso(agora = new Date()) {
  return hojeLisboa(agora);
}

const listaQuery = paginacao.merge(periodoQuery).extend({
  regime: regimeSchema.default("gold"),
  fase: z.enum(["abrir", "decorrer", "por_fechar", "fechada", "cancelada"]).optional().catch(undefined),
  curso: textoQuery(200),
  local: textoQuery(120),
  horario: textoQuery(80),
  formador: textoQuery(120),
  financiador: textoQuery(120),
});

const valoresHora = z.record(z.string().max(120), z.number().min(0).max(10000));

const turmaGoldSchema = z.object({
  dataInicio: z.string().max(20),
  nome: z.string().trim().min(1).max(80),
  curso: z.string().max(200),
  local: z.string().max(120).optional().default(""),
  horario: z.string().max(80).optional().default(""),
  totalAlunos: z.number().optional(),
  vagas: z.number().int().min(0).max(500).optional().default(16),
  toleranciaVagas: z.number().int().min(0).max(200).optional(),
  vagasAnunciadas: z.number().int().min(0).max(500).nullable().optional(),
  estado: z.string().max(20).optional().default("Ativa"),
  formador: z.string().max(120).optional().default(""),
  formadores: z.array(z.string().max(120)).max(12).optional().default([]),
  horas: z.number().min(0).max(2000).optional(),
  custoHoraSala: z.number().min(0).max(10000).optional(),
  valoresHoraFormador: valoresHora.optional(),
  cronograma: z.array(z.unknown()).max(2000).optional(),
});

const turmaFinSchema = z.object({
  dataInicio: z.string().max(20),
  nome: z.string().trim().min(1).max(120),
  curso: z.string().max(200),
  ufcdCod: z.string().max(20).optional().default(""),
  local: z.string().max(120).optional().default(""),
  horario: z.string().max(80).optional().default(""),
  alunos: z.number().optional(),
  alunosTotal: z.number().int().min(0).max(500).optional().default(20),
  toleranciaVagas: z.number().int().min(0).max(200).optional(),
  vagasAnunciadas: z.number().int().min(0).max(500).nullable().optional(),
  estado: z.string().max(40).optional().default("A montar"),
  horas: z.number().min(0).max(2000).optional(),
  formador: z.string().max(120).optional().default(""),
  formadores: z.array(z.string().max(120)).max(12).optional().default([]),
  activa: z.boolean().optional().default(true),
  financiador: z.string().trim().max(120).optional(),
  /** Número da ação (execução física: «UFCD … / Ação n»). */
  numeroAcao: z.number().int().min(1).max(9999).optional(),
  valoresHoraFormador: valoresHora.optional(),
  cronograma: z.array(z.unknown()).max(2000).optional(),
});

const regraSchema = z.object({
  regime: regimeSchema.optional().default("gold"),
  curso: z.string().trim().min(1).max(200),
  local: z.string().trim().max(120).optional().default(""),
  horario: z.string().trim().max(80).optional().default("Pós Laboral"),
  vagas: z.number().int().min(1).max(80).optional().default(16),
  horas: z.number().min(1).max(400).optional().default(25),
  horasSessao: z.number().min(1).max(8).optional().default(3),
  formador: z.string().trim().max(120).optional().default(""),
  proximaData: z.string().max(20).optional().default(""),
  nomePrefixo: z.string().trim().max(40).optional().default(""),
  activa: z.boolean().optional().default(true),
});

type Actor = NonNullable<FastifyRequest["actor"]>;

/**
 * O formador não altera a turma nem o cronograma (datas, horas, marcas de início e fim): na turma só preenche,
 * nas suas sessões, sumários, presenças e planos (rotas da pedagogia). As marcas não entram na folha de presenças.
 */
function negarFormador(actor: Actor) {
  return actor.role === "formador" ? "O formador não altera a turma nem o cronograma: consulta-os e preenche as suas sessões." : null;
}

async function erroCapacidade(deps: Deps, regime: Regime, id: number, atual: Record<string, unknown>, vagas?: number, tolerancia?: number) {
  if (vagas == null && tolerancia == null) return null;
  const capAtual = Number(regime === "gold" ? atual.vagas : atual.alunos_total) || 0;
  const capacidade = (vagas ?? capAtual) + (tolerancia ?? Number(atual.tolerancia_vagas ?? 0));
  const inscritos = await repo.contarOcupantes(deps.db, regime, id);
  return capacidade < inscritos ? `A turma já tem ${inscritos} formandos: a capacidade não pode ficar em ${capacidade}.` : null;
}

/**
 * Pastas, partilhas e atalhos da turma na Drive, dentro do pedido: na Vercel o que corre depois da resposta
 * fica congelado. Com limite, para a gravação nunca passar o tempo da função; o que faltar acaba na próxima
 * gravação (a sincronização é idempotente).
 */
export const LIMITE_SYNC_DRIVE_MS = 15_000;

async function sincronizarDrive(deps: Deps, regime: Regime, id: number, row: Record<string, unknown>) {
  let limite: ReturnType<typeof setTimeout> | undefined;
  const sync = syncTurmaDriveAccess(deps.db, {
    regime,
    turmaId: id,
    nome: String(row.nome ?? ""),
    formador: String(row.formador ?? ""),
    formadores: Array.isArray(row.formadores) ? row.formadores.map(String) : [],
    cronograma: row.cronograma,
  }).catch(() => undefined);
  await Promise.race([sync, new Promise(res => { limite = setTimeout(res, LIMITE_SYNC_DRIVE_MS); })]);
  clearTimeout(limite);
}

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  // ─── Lista ────────────────────────────────────────────────────────────────
  app.get("/v1/turmas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: listaQuery }, req);
    if (!v) return;
    const q = v.query;
    const actor = req.actor!;
    const formador = actor.role === "formador";
    if (!formador && !pode(actor.role, q.regime === "gold" ? "gold.ver" : "fin.ver")) {
      return reply.code(403).send({ error: "Sem acesso às turmas deste regime." });
    }
    const filtros: repo.FiltrosTurmas = {
      regime: q.regime,
      hoje: hojeIso(),
      docsObrigatorios: docsBase(q.regime).filter(d => d.required).map(d => d.id),
      fase: q.fase,
      curso: q.curso,
      local: q.local,
      horario: q.horario,
      formador: q.formador,
      financiador: q.financiador,
      de: q.de,
      ate: q.ate,
      q: q.q,
      apenasFormadores: formador
        ? [...await nomesDoFormador(db, actor.email, actor.name, actor.id)].map(n => n.toLowerCase())
        : undefined,
    };
    if (filtros.apenasFormadores && !filtros.apenasFormadores.length) filtros.apenasFormadores = ["\u0000"];
    const [pagina, resumo] = await Promise.all([
      repo.listarTurmas(db, filtros, { pagina: q.pagina, porPagina: q.porPagina, ordem: q.ordem }),
      repo.resumoTurmas(db, filtros),
    ]);
    return { ...pagina, resumo };
  });

  /** Uma turma completa (para o formulário de edição). */
  app.get("/v1/turmas/:regime/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: z.object({ regime: regimeSchema, id: idParam.shape.id }) }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const actor = req.actor!;
    if (actor.role !== "formador" && !pode(actor.role, regime === "gold" ? "gold.ver" : "fin.ver")) {
      return reply.code(403).send({ error: "Sem acesso às turmas deste regime." });
    }
    const row = await repo.obterTurma(db, regime, id);
    if (!row) return reply.code(404).send({ error: "turma não encontrada" });
    if (actor.role === "formador") {
      const nomes = [...await nomesDoFormador(db, actor.email, actor.name, actor.id)].map(n => n.toLowerCase());
      const dele = await repo.listarTurmas(db, {
        regime, hoje: hojeIso(), docsObrigatorios: [], apenasFormadores: nomes.length ? nomes : ["\u0000"], q: String(row.nome ?? ""),
      }, { pagina: 1, porPagina: 200 });
      if (!dele.linhas.some(l => l.id === id)) return reply.code(403).send({ error: "O formador só vê as turmas onde dá aulas." });
    }
    const turma = regime === "gold" ? mapTurmaGold(row) : { ...mapTurmaFin(row), financiador: String(row.financiador ?? "") };
    return { turma };
  });

  // ─── Gold ─────────────────────────────────────────────────────────────────
  app.post("/v1/turmas-gold", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor!.role === "formador") return reply.code(403).send({ error: "O formador não cria turmas." });
    const v = validar(reply, { body: turmaGoldSchema }, req);
    if (!v) return;
    const d = v.body;
    const slotErro = await erroDisponibilidade(db, [d.formador, ...d.formadores], d.horario);
    if (slotErro) return reply.code(400).send({ error: slotErro });
    d.horas ??= (await repo.dadosDoCurso(db, "gold", d.curso))?.horas || 90;
    const modulos = await modulosDaFicha(db, "gold", d.curso);
    const cronograma = comIdsUnicos(d.cronograma?.length
      ? d.cronograma
      : generateCronograma({ inicio: d.dataInicio, horario: d.horario, horas: d.horas, formador: d.formador, curso: d.curso, modulos }));
    const cruzamento = await erroSobreposicao(db, "gold", null, cronograma);
    if (cruzamento) return reply.code(400).send({ error: cruzamento });
    if (await repo.existeNome(db, "gold", d.nome, null)) {
      return reply.code(409).send({ error: `Já existe uma turma com o nome «${d.nome.trim()}». Use um código diferente.` });
    }
    const estado = normalizarEstado("turmaGold", d.estado);
    if (!estado) return reply.code(400).send({ error: `Estado inválido: «${d.estado}».` });
    const id = await nextOpsId(db);
    await repo.inserirTurmaGold(db, id, {
      dataInicio: d.dataInicio, nome: d.nome, curso: d.curso, local: d.local, horario: d.horario, vagas: d.vagas,
      tolerancia: d.toleranciaVagas ?? 0, estado, formador: d.formador, formadores: d.formadores, horas: d.horas,
      cronograma, custoHoraSala: d.custoHoraSala ?? 0, valoresHoraFormador: d.valoresHoraFormador ?? {},
    });
    await repo.ligarCurso(db, "gold", id);
    if (d.vagasAnunciadas !== undefined) await repo.gravarVagasAnunciadas(db, "gold", id, d.vagasAnunciadas);
    await importarPlanosCurso(db, "gold", id).catch(() => undefined);
    await audit(db, req.actor!.id, "turma.criar", "turma_gold", String(id), req.ip, { nome: d.nome });
    const row = await repo.obterTurma(db, "gold", id);
    if (row) await sincronizarDrive(deps, "gold", id, row);
    return { turma: row ? mapTurmaGold(row) : { id } };
  });

  app.patch("/v1/turmas-gold/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: turmaGoldSchema.partial() }, req);
    if (!v) return;
    const id = v.params.id;
    const bloqueio = negarFormador(req.actor!);
    if (bloqueio) return reply.code(403).send({ error: bloqueio });
    const d = v.body;
    // Valores por hora dos formadores e custo da sala são da gestão (a comercial não os vê nem os muda).
    // Os formulários reenviam-nos sempre: para a comercial ficam como estavam.
    if (req.actor!.role === "comercial") {
      delete d.valoresHoraFormador;
      delete d.custoHoraSala;
    }
    const antes = await repo.obterTurma(db, "gold", id);
    if (!antes) return reply.code(404).send({ error: "turma não encontrada" });
    if (antes.fechada_em && req.actor!.role !== "admin") return reply.code(409).send({ error: ERRO_TURMA_FECHADA });
    if (d.nome && await repo.existeNome(db, "gold", d.nome, id)) {
      return reply.code(409).send({ error: `Já existe uma turma com o nome «${d.nome.trim()}». Use um código diferente.` });
    }
    let estado: string | undefined;
    if (d.estado !== undefined) {
      const t = validarTransicao("turmaGold", String(antes.estado ?? ""), d.estado, req.actor!.role);
      if (!t.ok) return reply.code(409).send({ error: t.erro });
      estado = t.estado;
    }
    const cap = await erroCapacidade(deps, "gold", id, antes, d.vagas, d.toleranciaVagas);
    if (cap) return reply.code(409).send({ error: cap });
    if (d.formador != null || d.formadores != null || d.horario != null) {
      const extras = d.formadores ?? (Array.isArray(antes.formadores) ? antes.formadores.map(String) : []);
      const slotErro = await erroDisponibilidade(db, [d.formador ?? String(antes.formador ?? ""), ...extras], d.horario ?? String(antes.horario ?? ""));
      if (slotErro) return reply.code(400).send({ error: slotErro });
    }
    if (d.cronograma) {
      d.cronograma = comIdsUnicos(d.cronograma);
      const cruzamento = await erroSobreposicao(db, "gold", id, d.cronograma);
      if (cruzamento) return reply.code(400).send({ error: cruzamento });
      const removida = erroSessoesRemovidas(d.cronograma, await sessoesComDados(db, "gold", id), antes.cronograma);
      if (removida) return reply.code(409).send({ error: removida });
    }
    // Os dados das sessões seguem o id: depois de gravar o cronograma recalcula-se o número de cada uma.
    await db.tx(async q => {
      await repo.atualizarTurmaGold(q, id, {
        dataInicio: d.dataInicio, nome: d.nome, curso: d.curso, local: d.local, horario: d.horario, vagas: d.vagas,
        tolerancia: d.toleranciaVagas, estado, formador: d.formador, formadores: d.formadores, horas: d.horas,
        cronograma: d.cronograma, custoHoraSala: d.custoHoraSala, valoresHoraFormador: d.valoresHoraFormador,
      });
      if (d.cronograma) await renumerarSessoes(q, "gold", id);
    });
    if (d.vagasAnunciadas !== undefined) await repo.gravarVagasAnunciadas(db, "gold", id, d.vagasAnunciadas);
    if (d.nome && d.nome !== String(antes.nome ?? "")) await propagarNomeTurma(db, "gold", id, String(antes.nome ?? ""), d.nome);
    if (d.curso && d.curso !== String(antes.curso ?? "")) {
      await propagarCursoDaTurma(db, "gold", id, String(d.nome ?? antes.nome ?? ""), String(antes.curso ?? ""), d.curso);
      await repo.ligarCurso(db, "gold", id);
    }
    if ((d.cronograma || d.curso) && req.actor!.role !== "formador") await importarPlanosCurso(db, "gold", id).catch(() => undefined);
    if (req.actor!.role !== "formador") {
      await audit(db, req.actor!.id, "turma.alterar", "turma_gold", String(id), req.ip, { campos: Object.keys(d) });
    }
    const row = await repo.obterTurma(db, "gold", id);
    if (row) await sincronizarDrive(deps, "gold", id, row);
    return { turma: row ? mapTurmaGold(row) : null };
  });

  // ─── Financiada ───────────────────────────────────────────────────────────
  app.post("/v1/turmas-fin", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor!.role === "formador") return reply.code(403).send({ error: "O formador não cria turmas." });
    const v = validar(reply, { body: turmaFinSchema }, req);
    if (!v) return;
    const d = v.body;
    const curso = await repo.dadosDoCurso(db, "fin", d.curso);
    d.horas ??= curso?.horas || 25;
    d.ufcdCod ||= curso?.ufcd ?? "";
    const modulos = await modulosDaFicha(db, "fin", d.curso);
    const cronograma = comIdsUnicos(d.cronograma?.length
      ? d.cronograma
      : generateCronograma({
        inicio: d.dataInicio, horario: d.horario === "Online" ? "Pós Laboral" : d.horario, horas: d.horas,
        formador: d.formador, curso: d.curso, hoursPerSession: 3, modulos,
      }));
    const cruzamento = await erroSobreposicao(db, "fin", null, cronograma);
    if (cruzamento) return reply.code(400).send({ error: cruzamento });
    const slotErro = await erroDisponibilidade(db, [d.formador, ...d.formadores], d.horario);
    if (slotErro) return reply.code(400).send({ error: slotErro });
    if (await repo.existeNome(db, "fin", d.nome, null)) {
      return reply.code(409).send({ error: `Já existe uma turma com o nome «${d.nome.trim()}». Use um código diferente.` });
    }
    const estado = normalizarEstado("turmaFin", d.estado);
    if (!estado || estado === "Concluída") return reply.code(400).send({ error: `Estado inválido: «${d.estado}».` });
    const id = await nextOpsId(db);
    await repo.inserirTurmaFin(db, id, {
      dataInicio: d.dataInicio, nome: d.nome, curso: d.curso, ufcdCod: d.ufcdCod, local: d.local, horario: d.horario,
      alunosTotal: d.alunosTotal, tolerancia: d.toleranciaVagas ?? 0, estado, horas: d.horas, formador: d.formador,
      formadores: d.formadores, activa: d.activa, cronograma, valoresHoraFormador: d.valoresHoraFormador ?? {},
      financiador: d.financiador ?? "",
    });
    await repo.ligarCurso(db, "fin", id);
    if (d.vagasAnunciadas !== undefined) await repo.gravarVagasAnunciadas(db, "fin", id, d.vagasAnunciadas);
    if (d.numeroAcao !== undefined) await repo.gravarNumeroAcao(db, id, d.numeroAcao);
    await importarPlanosCurso(db, "fin", id).catch(() => undefined);
    await audit(db, req.actor!.id, "turma.criar", "turma_fin", String(id), req.ip, { nome: d.nome });
    const row = await repo.obterTurma(db, "fin", id);
    if (row) await sincronizarDrive(deps, "fin", id, row);
    return { turma: row ? { ...mapTurmaFin(row), financiador: String(row.financiador ?? "") } : { id } };
  });

  app.patch("/v1/turmas-fin/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: turmaFinSchema.partial() }, req);
    if (!v) return;
    const id = v.params.id;
    const bloqueio = negarFormador(req.actor!);
    if (bloqueio) return reply.code(403).send({ error: bloqueio });
    const d = v.body;
    const antes = await repo.obterTurma(db, "fin", id);
    if (!antes) return reply.code(404).send({ error: "turma não encontrada" });
    if (antes.fechada_em && req.actor!.role !== "admin") return reply.code(409).send({ error: ERRO_TURMA_FECHADA });
    if (d.nome && await repo.existeNome(db, "fin", d.nome, id)) {
      return reply.code(409).send({ error: `Já existe uma turma com o nome «${d.nome.trim()}». Use um código diferente.` });
    }
    let estado: string | undefined;
    if (d.estado !== undefined) {
      const t = validarTransicao("turmaFin", String(antes.estado ?? ""), d.estado, req.actor!.role);
      if (!t.ok) return reply.code(409).send({ error: t.erro });
      estado = t.estado;
    }
    const cap = await erroCapacidade(deps, "fin", id, antes, d.alunosTotal, d.toleranciaVagas);
    if (cap) return reply.code(409).send({ error: cap });
    if (d.formador != null || d.formadores != null || d.horario != null) {
      const extras = d.formadores ?? (Array.isArray(antes.formadores) ? antes.formadores.map(String) : []);
      const slotErro = await erroDisponibilidade(db, [d.formador ?? String(antes.formador ?? ""), ...extras], d.horario ?? String(antes.horario ?? ""));
      if (slotErro) return reply.code(400).send({ error: slotErro });
    }
    if (d.cronograma) {
      d.cronograma = comIdsUnicos(d.cronograma);
      const cruzamento = await erroSobreposicao(db, "fin", id, d.cronograma);
      if (cruzamento) return reply.code(400).send({ error: cruzamento });
      const removida = erroSessoesRemovidas(d.cronograma, await sessoesComDados(db, "fin", id), antes.cronograma);
      if (removida) return reply.code(409).send({ error: removida });
    }
    // Os dados das sessões seguem o id: depois de gravar o cronograma recalcula-se o número de cada uma.
    await db.tx(async q => {
      await repo.atualizarTurmaFin(q, id, {
        dataInicio: d.dataInicio, nome: d.nome, curso: d.curso, ufcdCod: d.ufcdCod, local: d.local, horario: d.horario,
        alunosTotal: d.alunosTotal, tolerancia: d.toleranciaVagas, estado, horas: d.horas, formador: d.formador,
        formadores: d.formadores, activa: d.activa, cronograma: d.cronograma, valoresHoraFormador: d.valoresHoraFormador,
        financiador: d.financiador,
      });
      if (d.cronograma) await renumerarSessoes(q, "fin", id);
    });
    if (d.vagasAnunciadas !== undefined) await repo.gravarVagasAnunciadas(db, "fin", id, d.vagasAnunciadas);
    if (d.numeroAcao !== undefined) await repo.gravarNumeroAcao(db, id, d.numeroAcao);
    if (d.nome && d.nome !== String(antes.nome ?? "")) await propagarNomeTurma(db, "fin", id, String(antes.nome ?? ""), d.nome);
    if (d.curso && d.curso !== String(antes.curso ?? "")) {
      await propagarCursoDaTurma(db, "fin", id, String(d.nome ?? antes.nome ?? ""), String(antes.curso ?? ""), d.curso);
      await repo.ligarCurso(db, "fin", id);
    }
    if ((d.cronograma || d.curso) && req.actor!.role !== "formador") await importarPlanosCurso(db, "fin", id).catch(() => undefined);
    if (req.actor!.role !== "formador") {
      await audit(db, req.actor!.id, "turma.alterar", "turma_fin", String(id), req.ip, { campos: Object.keys(d) });
    }
    const row = await repo.obterTurma(db, "fin", id);
    if (row) await sincronizarDrive(deps, "fin", id, row);
    return { turma: row ? { ...mapTurmaFin(row), financiador: String(row.financiador ?? "") } : null };
  });

  // ─── Apagar ───────────────────────────────────────────────────────────────
  for (const regime of ["gold", "fin"] as const) {
    app.delete(`/v1/turmas-${regime}/:id`, async (req, reply) => {
      if (!requireAuth(req, reply)) return;
      if (req.actor!.role === "formador") return reply.code(403).send({ error: "O formador não elimina turmas." });
      const v = validar(reply, { params: idParam }, req);
      if (!v) return;
      const id = v.params.id;
      const bloqueio = await bloqueioTurma(db, regime, id);
      if (bloqueio) return reply.code(409).send({ error: bloqueio });
      const antes = await repo.obterTurma(db, regime, id);
      await repo.apagarTurma(db, regime, id);
      await limparAtalhosDaTurma(db, regime, id).catch(() => undefined);
      await audit(db, req.actor!.id, "turma.apagar", `turma_${regime}`, String(id), req.ip, { nome: String(antes?.nome ?? "") });
      return { ok: true };
    });
  }

  // ─── Regras de abertura automática ────────────────────────────────────────
  app.get("/v1/turma-regras", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: z.object({ regime: regimeSchema.optional().catch(undefined) }) }, req);
    if (!v) return;
    return { regras: await listTurmaRegras(db, v.query.regime) };
  });

  app.post("/v1/turma-regras", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: regraSchema }, req);
    if (!v) return;
    const d = v.body;
    const id = await repo.inserirRegra(db, { ...d, horasSessao: d.regime === "fin" ? 3 : d.horasSessao });
    await audit(db, req.actor!.id, "turma_regra.criar", "turma_regra", String(id), req.ip);
    return { id };
  });

  app.patch("/v1/turma-regras/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: regraSchema.partial() }, req);
    if (!v) return;
    await repo.atualizarRegra(db, v.params.id, v.body);
    await audit(db, req.actor!.id, "turma_regra.alterar", "turma_regra", String(v.params.id), req.ip);
    return { ok: true };
  });

  app.delete("/v1/turma-regras/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    await repo.apagarRegra(db, v.params.id);
    await audit(db, req.actor!.id, "turma_regra.apagar", "turma_regra", String(v.params.id), req.ip);
    return { ok: true };
  });

  app.post("/v1/turmas/auto-regras", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: z.object({ regime: regimeSchema.optional() }).optional().default({}) }, req);
    if (!v) return;
    const r = await aplicarTurmaRegras(db, v.body.regime);
    await audit(db, req.actor!.id, "turmas.auto", "turma_regra", String(r.n), req.ip, r);
    return r;
  });
}
