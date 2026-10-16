/**
 * Formadores: lista com KPIs, ficha, documentos, criar/alterar/apagar.
 * A conta de acesso do formador cria-se com a ficha (palavra-passe temporária, mostrada uma vez).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DOCS_FORMADOR } from "../../../src/partilhado/dossierDocs.js";
import { formadorEstaAlocado, garantirContaFormador } from "../formadorConta.js";
import { bloqueioFormador, propagarFormador } from "../ligacoes.js";
import { nextOpsId } from "../ops.js";
import { pode } from "../permissoes/capacidades.js";
import { fichaDoProprioFormador } from "../sessaoAcesso.js";
import * as repo from "../repos/formadores.js";
import { idParam, paginacao, regime as regimeSchema, textoQuery, validar } from "../validacao.js";
import { hojeIso } from "./turmas.js";
import type { Deps } from "./tipos.js";

const SLOTS = ["laboral", "pos-laboral", "sabado-manha", "sabado-tarde"] as const;
const OBRIGATORIOS = DOCS_FORMADOR.filter(d => d.required).map(d => d.id);

const listaQuery = paginacao.extend({
  regime: regimeSchema.default("gold"),
  estado: z.enum(["Ativo", "Inactivo"]).optional().catch(undefined),
  especialidade: textoQuery(160),
  disponibilidade: z.enum(SLOTS).optional().catch(undefined),
  alerta: z.enum(["docs", "ccp", "com_turma", "sem_turma"]).optional().catch(undefined),
});

const dataOuVazio = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida (aaaa-mm-dd)")]);

const formadorSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  telf: z.string().trim().max(40).optional().default(""),
  email: z.string().trim().max(254).optional().default(""),
  especialidade: z.string().trim().max(160).optional().default(""),
  ccp: z.string().trim().max(40).optional().default(""),
  ccpValidade: dataOuVazio.optional(),
  nif: z.string().trim().max(40).optional().default(""),
  regimes: z.array(regimeSchema).min(1, "Escolha pelo menos um regime.").optional().default(["gold"]),
  estado: z.enum(["Ativo", "Inactivo"]).optional().default("Ativo"),
  disponibilidade: z.array(z.enum(SLOTS)).optional(),
  custoHora: z.number().min(0).max(10000).optional(),
});

const docsSchema = z.object({
  docs: z.array(z.object({
    id: z.string().trim().min(1).max(80),
    uploaded: z.boolean(),
    fileName: z.string().max(260).default(""),
    driveFileId: z.string().max(200).optional(),
    driveUrl: z.string().max(1000).optional(),
  })).max(60),
});

const periodoOcupacao = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida (aaaa-mm-dd)"),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data inválida (aaaa-mm-dd)"),
}).refine(p => p.de <= p.ate, { message: "o início tem de ser antes do fim", path: ["ate"] });

/** NIF e valores por hora são dados de pedagogia e gestão: o comercial vê a ficha sem eles. */
function veValores(role: string) {
  return role !== "comercial";
}

function semValores<T extends { nif?: string; custoHora?: number }>(f: T): T {
  return { ...f, nif: "", custoHora: 0 };
}

function limiteCcp(hoje: string) {
  const d = new Date(`${hoje}T12:00:00`);
  d.setDate(d.getDate() + 90);
  return d.toISOString().slice(0, 10);
}

type Acesso = { email: string; password?: string; criado: boolean } | null;

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  app.get("/v1/formadores", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { query: listaQuery }, req);
    if (!v) return;
    const q = v.query;
    const role = req.actor!.role;
    if (role === "formador" || !pode(role, q.regime === "gold" ? "gold.ver" : "fin.ver")) {
      return reply.code(403).send({ error: "Sem acesso à lista de formadores." });
    }
    const hoje = hojeIso();
    const base = { regime: q.regime, hoje, limiteCcp: limiteCcp(hoje), docsObrigatorios: OBRIGATORIOS };
    const [pagina, kpis, especialidades] = await Promise.all([
      repo.listarFormadores(db, { ...base, estado: q.estado, especialidade: q.especialidade, disponibilidade: q.disponibilidade, alerta: q.alerta, q: q.q },
        { pagina: q.pagina, porPagina: q.porPagina, ordem: q.ordem }),
      repo.kpisFormadores(db, base),
      repo.especialidades(db, q.regime),
    ]);
    const linhas = veValores(role) ? pagina.linhas : pagina.linhas.map(semValores);
    return { ...pagina, linhas, kpis, especialidades };
  });

  /** Horários ocupados do formador (sessões presenciais e síncronas de todas as turmas). */
  app.get("/v1/formadores/:id/ocupacao", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, query: periodoOcupacao }, req);
    if (!v) return;
    const role = req.actor!.role;
    const id = v.params.id;
    const permitido = role === "formador"
      ? await fichaDoProprioFormador(db, req.actor!, id)
      : pode(role, "gold.ver") || pode(role, "fin.ver");
    if (!permitido) return reply.code(403).send({ error: "Sem acesso à ocupação deste formador." });
    const row = await repo.obterFormador(db, id);
    if (!row) return reply.code(404).send({ error: "formador não encontrado" });
    const nome = String(row.nome ?? "");
    return { formador: { id, nome }, sessoes: await repo.ocupacaoFormador(db, nome, v.query.de, v.query.ate) };
  });

  /** A ficha da conta autenticada (área do formador). */
  app.get("/v1/formadores/eu", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const row = await repo.formadorDaConta(db, req.actor!.id, req.actor!.email);
    if (!row) return reply.code(404).send({ error: "Esta conta ainda não tem ficha de formador." });
    return { id: Number(row.id) };
  });

  app.get("/v1/formadores/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const id = v.params.id;
    if (!(await fichaDoProprioFormador(db, req.actor!, id))) return reply.code(403).send({ error: "O formador só consulta a própria ficha." });
    const row = await repo.obterFormador(db, id);
    if (!row) return reply.code(404).send({ error: "formador não encontrado" });
    const formador = repo.mapFormadorBase(row);
    const hoje = hojeIso();
    const [turmas, sessoes, docs, acesso] = await Promise.all([
      repo.turmasDaFicha(db, formador.nome, hoje, formador.custoHora),
      repo.proximasSessoes(db, formador.nome, "0000-00-00", 2000),
      repo.docsDoFormador(db, id),
      repo.acessoDoFormador(db, row.user_id ? String(row.user_id) : null),
    ]);
    const totais = {
      turmas: turmas.length,
      turmasAtivas: turmas.filter(t => !t.fechada && t.horasPendentes > 0).length,
      horasDadas: Math.round(turmas.reduce((s, t) => s + t.horasDadas, 0) * 10) / 10,
      horasPendentes: Math.round(turmas.reduce((s, t) => s + t.horasPendentes, 0) * 10) / 10,
      valorDado: Math.round(turmas.reduce((s, t) => s + t.valorDado, 0) * 100) / 100,
      docsEmFalta: OBRIGATORIOS.filter(o => !docs.some(d => d.id === o && d.uploaded)).length,
    };
    const ccpExpirado = Boolean(formador.ccpValidade && formador.ccpValidade < hoje);
    const ccpAExpirar = Boolean(formador.ccpValidade && formador.ccpValidade <= limiteCcp(hoje));
    if (!veValores(req.actor!.role)) {
      return {
        formador: { ...semValores(formador), ccpExpirado, ccpAExpirar },
        turmas: turmas.map(t => ({ ...t, valorHora: 0, valorDado: 0 })),
        sessoes, docs, acesso, totais: { ...totais, valorDado: 0 }, hoje,
      };
    }
    return { formador: { ...formador, ccpExpirado, ccpAExpirar }, turmas, sessoes, docs, acesso, totais, hoje };
  });

  app.post("/v1/formadores", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { body: formadorSchema }, req);
    if (!v) return;
    const d = v.body;
    const id = await nextOpsId(db);
    await repo.inserirFormador(db, id, {
      nome: d.nome, telf: d.telf, email: d.email, especialidade: d.especialidade, ccp: d.ccp, ccpValidade: d.ccpValidade || null,
      nif: d.nif, regimes: d.regimes, estado: d.estado, disponibilidade: d.disponibilidade ?? [...SLOTS], custoHora: d.custoHora ?? 0,
    });
    const conta = await garantirContaFormador(db, d.nome, d.email);
    if (conta) await repo.ligarConta(db, id, conta.userId);
    if (conta && d.estado === "Inactivo") await repo.definirContaActiva(db, id, false);
    await audit(db, req.actor!.id, "formador.criar", "formador", String(id), req.ip, { conta: Boolean(conta) });
    const row = await repo.obterFormador(db, id);
    const acesso: Acesso = conta ? (conta.criado ? { email: conta.email, password: conta.password, criado: true } : { email: conta.email, criado: false }) : null;
    return { formador: row ? { ...repo.mapFormadorBase(row), alocado: false } : { id }, acesso };
  });

  app.patch("/v1/formadores/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: formadorSchema.partial() }, req);
    if (!v) return;
    const id = v.params.id;
    const d = v.body;
    const antes = await repo.obterFormador(db, id);
    if (!antes) return reply.code(404).send({ error: "formador não encontrado" });
    // O formador (a sua ficha) e o comercial (formadores da Gold) só mexem na disponibilidade.
    const role = req.actor!.role;
    if (role === "formador" || role === "comercial") {
      if (role === "formador" && String(antes.user_id ?? "") !== req.actor!.id) return reply.code(403).send({ error: "O formador só altera a própria disponibilidade." });
      if (role === "comercial" && !repo.mapFormadorBase(antes).regimes.includes("gold")) return reply.code(403).send({ error: "Sem acesso a este formador." });
      if (role === "comercial" && Object.keys(d).some(k => k !== "disponibilidade")) return reply.code(403).send({ error: "O comercial só altera a disponibilidade." });
      if (!d.disponibilidade) return reply.code(400).send({ error: "Indique a disponibilidade." });
      await repo.atualizarFormador(db, id, { disponibilidade: d.disponibilidade });
      await audit(db, req.actor!.id, "formador.disponibilidade", "formador", String(id), req.ip);
      const row = await repo.obterFormador(db, id);
      const base = row ? { ...repo.mapFormadorBase(row), alocado: await formadorEstaAlocado(db, String(row.nome ?? "")) } : null;
      return { formador: base && !veValores(role) ? semValores(base) : base, acesso: null };
    }
    await repo.atualizarFormador(db, id, d);
    if (d.nome && d.nome !== String(antes.nome ?? "")) await propagarFormador(db, String(antes.nome ?? ""), d.nome);
    let acesso: Acesso = null;
    const email = d.email ?? String(antes.email ?? "");
    if (!antes.user_id && email) {
      const conta = await garantirContaFormador(db, d.nome ?? String(antes.nome ?? ""), email);
      if (conta) {
        await repo.ligarConta(db, id, conta.userId);
        acesso = conta.criado ? { email: conta.email, password: conta.password, criado: true } : { email: conta.email, criado: false };
      }
    }
    // Inactivo não entra: a conta acompanha o estado da ficha.
    const estado = d.estado ?? String(antes.estado ?? "");
    if (d.estado || (acesso && estado === "Inactivo")) await repo.definirContaActiva(db, id, estado !== "Inactivo");
    await audit(db, req.actor!.id, "formador.alterar", "formador", String(id), req.ip, { campos: Object.keys(d), conta: Boolean(acesso) });
    const row = await repo.obterFormador(db, id);
    const formador = row ? { ...repo.mapFormadorBase(row), alocado: await formadorEstaAlocado(db, String(row.nome ?? "")) } : null;
    return { formador, acesso };
  });

  app.delete("/v1/formadores/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const id = v.params.id;
    const bloqueio = await bloqueioFormador(db, id);
    if (bloqueio) return reply.code(409).send({ error: bloqueio });
    const antes = await repo.obterFormador(db, id);
    await repo.apagarFormadorEConta(db, id);
    await audit(db, req.actor!.id, "formador.apagar", "formador", String(id), req.ip, { nome: String(antes?.nome ?? "") });
    return { ok: true };
  });

  // ─── Documentos ───────────────────────────────────────────────────────────
  app.get("/v1/formadores/:id/docs", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    if (!(await fichaDoProprioFormador(db, req.actor!, v.params.id))) return reply.code(403).send({ error: "O formador só consulta os próprios documentos." });
    const docs = await repo.docsDoFormador(db, v.params.id);
    return { docs: docs.map(({ atualizadoEm: _a, ...d }) => d) };
  });

  app.put("/v1/formadores/:id/docs", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: docsSchema }, req);
    if (!v) return;
    const id = v.params.id;
    if (!(await fichaDoProprioFormador(db, req.actor!, id))) return reply.code(403).send({ error: "O formador só altera os próprios documentos." });
    for (const doc of v.body.docs) await repo.gravarDocFormador(db, id, doc);
    await audit(db, req.actor!.id, "formador.docs", "formador", String(id), req.ip);
    const { sincronizarAtalhosDoFormador } = await import("../driveArvore.js");
    await sincronizarAtalhosDoFormador(db, id).catch(() => undefined);
    return { ok: true };
  });
}
