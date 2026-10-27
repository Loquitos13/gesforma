/**
 * Formadores: lista com KPIs, ficha, documentos, criar/alterar/apagar.
 * A conta de acesso do formador cria-se com a ficha (palavra-passe temporária, mostrada uma vez).
 */
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { DOCS_FORMADOR } from "../../../src/partilhado/dossierDocs.js";
import { ContaFormadorEmUso, formadorEstaAlocado, garantirContaFormador, palavraPasseDaConta } from "../formadorConta.js";
import { mapFile } from "../driveFicheiros.js";
import { bloqueioFormador, propagarFormador } from "../ligacoes.js";
import { sincronizarTurmasDoFormador } from "../despesasFormador.js";
import { sincronizarSemFalhar } from "../reembolso.js";
import { ficheiroDrive } from "../repos/drive.js";
import { nextOpsId } from "../ops.js";
import { pode } from "../permissoes/capacidades.js";
import { fichaDoProprioFormador } from "../sessaoAcesso.js";
import * as repo from "../repos/formadores.js";
import { hashPassword, normalizeEmail } from "../security.js";
import { mensagemPalavraPasse, palavraPasseValida } from "../../../src/partilhado/passwordPolicy.js";
import { idParam, paginacao, regime as regimeSchema, textoQuery, validar } from "../validacao.js";
import { hojeIso } from "./turmas.js";
import type { Deps } from "./tipos.js";
import { somarDias } from "../datas.js";

const SLOTS = ["laboral", "pos-laboral", "sabado-manha", "sabado-tarde"] as const;
const OBRIGATORIOS = DOCS_FORMADOR.filter(d => d.required).map(d => d.id);
const TIPOS_DOC = new Set(DOCS_FORMADOR.map(d => d.id));

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

/** Palavra-passe do acesso: vazia = gerar uma temporária; escolhida = fica (ou troca-se no primeiro acesso, se `temporaria`). */
const acessoSchema = z.object({
  password: z.string().max(128).optional().default(""),
  temporaria: z.boolean().optional().default(false),
});

/** A palavra-passe escolhida tem de cumprir as regras da plataforma (mensagem de erro, ou null). */
function erroPalavraPasseEscolhida(a: { password: string } | undefined) {
  return a?.password && !palavraPasseValida(a.password) ? mensagemPalavraPasse(a.password) : null;
}

/** O que a equipa vê do acesso: a palavra-passe só quando foi gerada (a escolhida já a sabe). */
function acessoCriado(conta: { email: string; password: string; temporaria: boolean; escolhida: boolean }): Acesso {
  return { email: conta.email, ...(conta.escolhida ? {} : { password: conta.password }), criado: true, temporaria: conta.temporaria };
}

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

const veRegime = (role: string, r: string) => pode(role, r === "gold" ? "gold.ver" : "fin.ver");

/**
 * Criar e apagar exigem ver todos os regimes da ficha, como a lista (a Financiada não apaga um formador da Gold).
 * Alterar exige ver pelo menos um regime da ficha e cada regime que se junta ou retira (`podeAlterarRegimes`).
 */
function veRegimes(role: string, regimes: readonly string[]) {
  return regimes.every(r => veRegime(role, r));
}

function veAlgumRegime(role: string, regimes: readonly string[]) {
  return regimes.some(r => veRegime(role, r));
}

/** Quem altera a ficha só junta ou retira os regimes que vê: a Financiada não tira um formador da Gold. */
function podeAlterarRegimes(role: string, antes: readonly string[], depois: readonly string[] | undefined) {
  if (!depois) return true;
  const mudados = [...depois.filter(r => !antes.includes(r)), ...antes.filter(r => !depois.includes(r))];
  return veRegimes(role, mudados);
}

const SEM_REGIME = "Sem acesso a formadores deste regime.";

function limiteCcp(hoje: string) {
  return somarDias(hoje, 90);
}

type Acesso = { email: string; password?: string; criado: boolean; temporaria?: boolean } | null;

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  /**
   * O formador não marca documentos como entregues: só conta o que carregou para a sua ficha. Aceitam-se
   * os tipos de DOCS_FORMADOR com um ficheiro `formador-doc` deste formador; nome e ligação vêm desse
   * registo, nunca do corpo. O resto da lista (que a ficha reenvia tal como está) fica como estava.
   */
  async function docsEnviadosPeloFormador(id: number, docs: z.infer<typeof docsSchema>["docs"]) {
    const ficha = await repo.obterFormador(db, id);
    const nome = String(ficha?.nome ?? "").trim().toLowerCase();
    const out: { id: string; uploaded: boolean; fileName: string; driveFileId: string; driveUrl: string }[] = [];
    for (const doc of docs) {
      if (!TIPOS_DOC.has(doc.id) || !doc.uploaded || !doc.driveFileId) continue;
      const f = await ficheiroDrive(db, doc.driveFileId);
      if (!f || f.kind !== "formador-doc" || !nome || String(f.formando ?? "").trim().toLowerCase() !== nome) continue;
      const m = mapFile(f);
      out.push({ id: doc.id, uploaded: true, fileName: m.name, driveFileId: m.id, driveUrl: m.openUrl });
    }
    return out;
  }

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
    // Gold e Financiada não se misturam: só a ficha de quem trabalha num regime que vê, e só as turmas desse regime.
    const role = req.actor!.role;
    if (role !== "formador" && !veAlgumRegime(role, formador.regimes)) return reply.code(403).send({ error: SEM_REGIME });
    const doRegime = (t: { regime: string }) => role === "formador" || veRegime(role, t.regime);
    const hoje = hojeIso();
    const [todasTurmas, todasSessoes, docs, acesso] = await Promise.all([
      repo.turmasDaFicha(db, formador.nome, hoje, formador.custoHora),
      repo.proximasSessoes(db, formador.nome, "0000-00-00", 2000),
      repo.docsDoFormador(db, id),
      repo.acessoDoFormador(db, row.user_id ? String(row.user_id) : null),
    ]);
    const turmas = todasTurmas.filter(doRegime);
    const sessoes = todasSessoes.filter(doRegime);
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
    const v = validar(reply, { body: formadorSchema.extend({ acesso: acessoSchema.optional() }) }, req);
    if (!v) return;
    const d = v.body;
    if (!veRegimes(req.actor!.role, d.regimes)) return reply.code(403).send({ error: SEM_REGIME });
    const erroPasse = erroPalavraPasseEscolhida(d.acesso);
    if (erroPasse) return reply.code(400).send({ error: erroPasse });
    const id = await nextOpsId(db);
    // Ficha e conta juntas: um email recusado (409) não deixa a ficha criada a meio.
    let conta: Awaited<ReturnType<typeof garantirContaFormador>>;
    try {
      conta = await db.tx(async q => {
        await repo.inserirFormador(q, id, {
          nome: d.nome, telf: d.telf, email: d.email, especialidade: d.especialidade, ccp: d.ccp, ccpValidade: d.ccpValidade || null,
          nif: d.nif, regimes: d.regimes, estado: d.estado, disponibilidade: d.disponibilidade ?? [...SLOTS], custoHora: d.custoHora ?? 0,
        });
        const c = await garantirContaFormador(q, d.nome, d.email, id, d.acesso);
        if (c) await repo.ligarConta(q, id, c.userId);
        if (c && d.estado === "Inactivo") await repo.definirContaActiva(q, id, false);
        return c;
      });
    } catch (err) {
      if (err instanceof ContaFormadorEmUso && err.fichaId != null) {
        // A mesma pessoa noutro regime: não se cria outra ficha, junta-se o regime à que existe.
        return reply.code(409).send({
          error: `Já existe a ficha de um formador com o email ${normalizeEmail(d.email)}. Se é a mesma pessoa, junte o regime a essa ficha em vez de criar outra.`,
          fichaExistente: err.fichaId,
        });
      }
      if (err instanceof ContaFormadorEmUso) return reply.code(409).send({ error: err.message });
      throw err;
    }
    await audit(db, req.actor!.id, "formador.criar", "formador", String(id), req.ip, { conta: Boolean(conta) });
    // Uma turma da Financiada que já tinha este nome passa a ter o custo por hora e o NIF da ficha nas despesas.
    if (d.custoHora || d.nif) await sincronizarTurmasDoFormador(db, d.nome);
    const row = await repo.obterFormador(db, id);
    const acesso: Acesso = conta ? (conta.criado ? acessoCriado(conta) : { email: conta.email, criado: false }) : null;
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
    // O formador (a sua ficha) só mexe na disponibilidade. O comercial não chega aqui (permissoes/comercial.ts).
    const role = req.actor!.role;
    if (role === "formador") {
      if (String(antes.user_id ?? "") !== req.actor!.id) return reply.code(403).send({ error: "O formador só altera a própria disponibilidade." });
      if (!d.disponibilidade) return reply.code(400).send({ error: "Indique a disponibilidade." });
      await repo.atualizarFormador(db, id, { disponibilidade: d.disponibilidade });
      await audit(db, req.actor!.id, "formador.disponibilidade", "formador", String(id), req.ip);
      const row = await repo.obterFormador(db, id);
      const base = row ? { ...repo.mapFormadorBase(row), alocado: await formadorEstaAlocado(db, String(row.nome ?? "")) } : null;
      return { formador: base && !veValores(role) ? semValores(base) : base, acesso: null };
    }
    const regimesAntes = repo.mapFormadorBase(antes).regimes;
    if (!veAlgumRegime(role, regimesAntes) || !podeAlterarRegimes(role, regimesAntes, d.regimes)) {
      return reply.code(403).send({ error: SEM_REGIME });
    }
    let acesso: Acesso = null;
    try {
      acesso = await db.tx(async q => {
        await repo.atualizarFormador(q, id, d);
        let a: Acesso = null;
        // A conta só se cria ou liga quando o email muda (ou passa a existir): uma ficha antiga sem conta, cujo
        // email é de outra conta, continua a gravar o resto dos campos.
        const email = d.email ?? "";
        const emailNovo = Boolean(email) && normalizeEmail(email) !== normalizeEmail(String(antes.email ?? ""));
        if (!antes.user_id && emailNovo) {
          const conta = await garantirContaFormador(q, d.nome ?? String(antes.nome ?? ""), email, id);
          if (conta) {
            await repo.ligarConta(q, id, conta.userId);
            a = conta.criado ? { email: conta.email, password: conta.password, criado: true } : { email: conta.email, criado: false };
          }
        }
        // Inactivo não entra: a conta acompanha o estado da ficha.
        const estado = d.estado ?? String(antes.estado ?? "");
        if (d.estado || (a && estado === "Inactivo")) await repo.definirContaActiva(q, id, estado !== "Inactivo");
        return a;
      });
    } catch (err) {
      if (err instanceof ContaFormadorEmUso) return reply.code(409).send({ error: err.message });
      throw err;
    }
    if (d.nome && d.nome !== String(antes.nome ?? "")) await propagarFormador(db, String(antes.nome ?? ""), d.nome);
    // Financiada: as despesas automáticas do formador (NIF, nome e custo por hora da ficha) acompanham a ficha.
    const mudouCusto = d.custoHora !== undefined && Number(d.custoHora) !== Number(antes.custo_hora ?? 0);
    const mudouNif = d.nif !== undefined && d.nif !== String(antes.nif ?? "");
    if (mudouCusto || mudouNif || (d.nome && d.nome !== String(antes.nome ?? ""))) {
      for (const turmaId of await sincronizarTurmasDoFormador(db, d.nome ?? String(antes.nome ?? ""))) {
        const erro = await sincronizarSemFalhar(db, req.actor!.id, turmaId, "despesas");
        if (erro) req.log.warn({ turma: turmaId, erro }, "ficheiro de despesas da turma não actualizado na Drive");
      }
    }
    await audit(db, req.actor!.id, "formador.alterar", "formador", String(id), req.ip, { campos: Object.keys(d), conta: Boolean(acesso) });
    const row = await repo.obterFormador(db, id);
    const formador = row ? { ...repo.mapFormadorBase(row), alocado: await formadorEstaAlocado(db, String(row.nome ?? "")) } : null;
    return { formador, acesso };
  });

  /**
   * Nova palavra-passe para o formador (ou a conta, se a ficha ainda não a tem): gerada e temporária (mostra-se uma
   * vez), ou a escolhida pela equipa (fica, salvo se pedir a troca no próximo acesso).
   */
  app.post("/v1/formadores/:id/acesso", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: acessoSchema.optional() }, req);
    if (!v) return;
    const id = v.params.id;
    const erroPasse = erroPalavraPasseEscolhida(v.body);
    if (erroPasse) return reply.code(400).send({ error: erroPasse });
    const escolha = v.body?.password ? v.body : undefined;
    const antes = await repo.obterFormador(db, id);
    if (!antes) return reply.code(404).send({ error: "formador não encontrado" });
    if (!veAlgumRegime(req.actor!.role, repo.mapFormadorBase(antes).regimes)) return reply.code(403).send({ error: SEM_REGIME });
    const email = normalizeEmail(String(antes.email ?? ""));
    if (!email) return reply.code(400).send({ error: "A ficha não tem email: indique-o para criar o acesso." });
    let acesso: Acesso = null;
    try {
      acesso = await db.tx(async q => {
        const repor = async (userId: string, mail: string): Promise<Acesso> => {
          const { password, temporaria } = palavraPasseDaConta(escolha);
          if (!(await repo.reporContaFormador(q, userId, await hashPassword(password), temporaria))) return null;
          return { email: mail, ...(escolha ? {} : { password }), criado: false, temporaria };
        };
        if (antes.user_id) return repor(String(antes.user_id), email);
        const conta = await garantirContaFormador(q, String(antes.nome ?? ""), email, id, escolha);
        if (!conta) return null;
        await repo.ligarConta(q, id, conta.userId);
        if (conta.criado) return acessoCriado(conta);
        return repor(conta.userId, conta.email);
      });
    } catch (err) {
      if (err instanceof ContaFormadorEmUso) return reply.code(409).send({ error: err.message });
      throw err;
    }
    if (!acesso) return reply.code(409).send({ error: "A conta ligada a esta ficha não é de formador." });
    await audit(db, req.actor!.id, "formador.acesso_reposto", "formador", String(id), req.ip, { criado: acesso.criado });
    return { acesso };
  });

  app.delete("/v1/formadores/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam }, req);
    if (!v) return;
    const id = v.params.id;
    const antes = await repo.obterFormador(db, id);
    if (!antes) return reply.code(404).send({ error: "formador não encontrado" });
    // Apagar tira a ficha (e a conta) de todos os regimes: com um regime que não vê, retira-se só o seu na ficha.
    const regimes = repo.mapFormadorBase(antes).regimes;
    if (!veRegimes(req.actor!.role, regimes)) {
      if (!veAlgumRegime(req.actor!.role, regimes)) return reply.code(403).send({ error: SEM_REGIME });
      return reply.code(403).send({ error: "Este formador também trabalha noutro regime: em vez de apagar, retire o seu regime na ficha." });
    }
    const bloqueio = await bloqueioFormador(db, id);
    if (bloqueio) return reply.code(409).send({ error: bloqueio });
    await repo.apagarFormadorEConta(db, id);
    await audit(db, req.actor!.id, "formador.apagar", "formador", String(id), req.ip, { nome: String(antes?.nome ?? "") });
    return { ok: true };
  });

  /**
   * Junta um regime à ficha de um formador que já existe (ex.: a Financiada junta «fin» a um formador da Gold
   * cujo email deu 409 ao criar). Só o regime de quem pede, e só com o email da ficha: não basta adivinhar o id.
   */
  app.post("/v1/formadores/:id/regimes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: z.object({ regime: regimeSchema, email: z.string().trim().max(254) }) }, req);
    if (!v) return;
    const role = req.actor!.role;
    if (role === "formador" || role === "comercial" || !veRegime(role, v.body.regime)) return reply.code(403).send({ error: SEM_REGIME });
    const antes = await repo.obterFormador(db, v.params.id);
    const email = normalizeEmail(v.body.email);
    if (!antes || !email || normalizeEmail(String(antes.email ?? "")) !== email) {
      return reply.code(404).send({ error: "Não há formador com esse email nesta ficha." });
    }
    const regimes = repo.mapFormadorBase(antes).regimes;
    if (!regimes.includes(v.body.regime)) {
      await repo.atualizarFormador(db, v.params.id, { regimes: [...regimes, v.body.regime] });
      await audit(db, req.actor!.id, "formador.regime", "formador", String(v.params.id), req.ip, { regime: v.body.regime });
    }
    const row = await repo.obterFormador(db, v.params.id);
    const base = row ? { ...repo.mapFormadorBase(row), alocado: await formadorEstaAlocado(db, String(row.nome ?? "")) } : null;
    return { formador: base && !veValores(role) ? semValores(base) : base, acesso: null };
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
    const docs = req.actor!.role === "formador" ? await docsEnviadosPeloFormador(id, v.body.docs) : v.body.docs;
    for (const doc of docs) await repo.gravarDocFormador(db, id, doc);
    await audit(db, req.actor!.id, "formador.docs", "formador", String(id), req.ip);
    const { sincronizarAtalhosDoFormador } = await import("../driveArvore.js");
    await sincronizarAtalhosDoFormador(db, id).catch(() => undefined);
    return { ok: true };
  });
}
