import type { FastifyInstance, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { codigoCursoValido, normalizarCodigoCurso } from "../../../src/partilhado/codigoCurso.js";
import { areaCnaefValida } from "../../../src/partilhado/execucaoFisica.js";
import { localDoElearning, moradaDoLocalElearning } from "../../../src/partilhado/regimeSincronia.js";
import { RESUMO_MAX, SINTESE_MAX } from "../../../src/partilhado/textosCurso.js";
import { criarItem, listarItens, proximoIdCatalogo } from "../repos/catalogoItens.js";
import { storeDriveFile } from "../driveFicheiros.js";
import { bloqueioCursoFin, bloqueioCursoGold, propagarCursoNoRegime } from "../ligacoes.js";
import { dtpEstrutura, DTP_FASES } from "../dtpModel.js";
import { packDoCurso } from "../pedagogia/dtp.js";
import { guardarImagemCurso, semIdNaMedia, slotImagem, urlsImagemDoCurso } from "../cursoImagens.js";
import {
  cursoPedeDocsPreinscricao, docsBase, gravarDocsPreinscricao, lerDocsPreinscricao, limparModelosFora, listarModelosConsentimento,
} from "../docsCurso.js";
import * as repo from "../repos/cursos.js";
import { importarParaTurmasDoCurso } from "../planosCurso.js";
import { idNum, regime as regimeEnum, regimeIdParam, regimeParam, textoQuery, validar } from "../validacao.js";
import type { Deps } from "./tipos.js";

const cursoGoldSchema = z.object({
  nome: z.string().trim().min(1).max(200),
  categoria: z.string().trim().min(1).max(120),
  tipo: z.string().trim().min(1).max(40),
  preco: z.number().min(0).max(100_000),
  regime: z.string().trim().min(1).max(40),
  horas: z.number().int().min(1).max(5000),
  estado: z.string().trim().max(40).optional().default("Ativo"),
  entidadeResponsavelId: idNum.nullable().optional(),
});

const cursoFinSchema = z.object({
  ufcdCod: z.string().trim().max(20).transform(normalizarCodigoCurso)
    .refine(codigoCursoValido, "Código UFCD (ex. 8995) ou UC (ex. UC00277)."),
  ufcd: z.string().trim().min(1).max(200),
  nomeComercial: z.string().trim().min(1).max(200),
  regime: z.string().trim().min(1).max(40),
  horas: z.number().int().min(1).max(5000),
  estado: z.string().trim().max(40).optional().default("Ativo"),
  /** Área de formação CNAEF (lista do template de execução física); vazia enquanto não se sabe. */
  areaCnaef: z.union([z.literal(""), z.string().refine(areaCnaefValida, "Área CNAEF fora da lista.")]).optional().default(""),
});

const listaQuery = z.object({
  q: textoQuery(120),
  estado: textoQuery(40),
  categoria: textoQuery(120),
  tipo: textoQuery(40),
  modalidade: textoQuery(40),
  ordem: textoQuery(40),
});

const fichaSchema = z.object({
  // O payload é livre; só se validam os campos com valores fechados.
  payload: z.record(z.unknown())
    .refine(p => p.regimeSincronia === undefined || ["", "sincrono", "assincrono"].includes(String(p.regimeSincronia)), "Regime: síncrono ou assíncrono.")
    .refine(p => p.organizacaoPrograma === undefined || p.organizacaoPrograma === "modular" || p.organizacaoPrograma === "livre", "Tipo de programa: modular ou livre.")
    .refine(p => p.resumo === undefined || (typeof p.resumo === "string" && p.resumo.trim().length <= RESUMO_MAX), `Texto de destaque (catálogo): até ${RESUMO_MAX} caracteres.`)
    .refine(p => p.sintese === undefined || (typeof p.sintese === "string" && p.sintese.length <= SINTESE_MAX), `Texto completo (ficha do curso): até ${SINTESE_MAX} caracteres.`)
    .optional(),
  criterios: z.array(z.object({ id: z.string().max(60), label: z.string().max(200) })).max(40).optional(),
}).refine(v => v.payload || v.criterios, { message: "vazio" });

const docsPreSchema = z.object({
  ocultos: z.array(z.string().max(60)).max(40).default([]),
  extra: z.array(z.object({
    id: z.string().max(48).optional(),
    label: z.string().trim().min(3).max(160),
    required: z.boolean(),
  })).max(30).default([]),
});

const idsCurso = z.object({ regime: regimeEnum, id: idNum });
const ficheiroParam = idsCurso.extend({ ficheiroId: z.string().min(1).max(40) });
const docParam = idsCurso.extend({ docId: z.string().min(1).max(48) });
const imagemParam = idsCurso.extend({ slot: z.string().max(20) });
const idParam = z.object({ id: idNum });

function asObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try { const p = JSON.parse(v) as unknown; return p && typeof p === "object" && !Array.isArray(p) ? p as Record<string, unknown> : {}; } catch { return {}; }
  }
  return {};
}

function asArr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try { const p = JSON.parse(v) as unknown; return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

/** Os valores-hora dos formadores só são vistos pela secretaria e pelo admin. */
function fichaParaPapel(payload: Record<string, unknown>, role: string) {
  if (role === "admin" || role === "secretaria") return payload;
  const { valoresFormador: _interno, ...resto } = payload;
  return resto;
}

/** Lê um multipart com um ficheiro e campos de texto. */
async function lerMultipart(req: FastifyRequest) {
  const campos: Record<string, string> = {};
  let ficheiro: { nome: string; mime: string; bytes: Buffer } | null = null;
  for await (const part of req.parts()) {
    if (part.type === "file") ficheiro = { nome: part.filename || "ficheiro", mime: part.mimetype || "", bytes: await part.toBuffer() };
    else campos[part.fieldname] = String(part.value ?? "");
  }
  return { campos, ficheiro };
}

function slugDoc(label: string) {
  const slug = label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 36);
  return `pre-${slug || "doc"}`;
}

const NOME_REPETIDO = "Já existe um curso com este nome neste regime.";

export async function registar(app: FastifyInstance, deps: Deps) {
  const { db, requireAuth, audit } = deps;

  // ── Catálogo ──────────────────────────────────────────────────────────────
  app.get("/v1/cursos/:regime", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeParam, query: listaQuery }, req);
    if (!v) return;
    const regime = v.params.regime;
    const cursos = regime === "gold" ? await repo.listarCursosGold(db, v.query) : await repo.listarCursosFin(db, v.query);
    return { cursos, resumo: await repo.resumoCursos(db, regime) };
  });

  app.get("/v1/cursos/:regime/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeIdParam }, req);
    if (!v) return;
    const curso = await repo.obterCurso(db, v.params.regime, v.params.id);
    if (!curso) return reply.code(404).send({ error: "curso não encontrado" });
    return { curso, turmas: await repo.turmasDoCurso(db, v.params.regime, v.params.id) };
  });

  app.post("/v1/cursos-gold", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = cursoGoldSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Preencha nome, categoria, tipo comercial, modalidade, preço e horas." });
    const ent = parsed.data.entidadeResponsavelId;
    if (ent != null && !(await repo.entidadeExiste(db, ent))) return reply.code(400).send({ error: "Entidade responsável inexistente." });
    const nome = parsed.data.nome;
    const id = await db.tx(async q => {
      await repo.trancarNomesCursos(q, "gold");
      if (await repo.nomeCursoOcupado(q, "gold", nome)) return null;
      const novo = await repo.proximoId(q);
      await repo.criarCursoGold(q, novo, parsed.data);
      return novo;
    });
    if (id == null) return reply.code(409).send({ error: NOME_REPETIDO });
    await audit(db, req.actor?.id, "curso.criar", "curso", String(id), req.ip, { regime: "gold", nome: parsed.data.nome });
    return { curso: await repo.obterCurso(db, "gold", id) };
  });

  app.patch("/v1/cursos-gold/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: cursoGoldSchema.partial() }, req);
    if (!v) return;
    const antes = await repo.obterCursoGold(db, v.params.id);
    if (!antes) return reply.code(404).send({ error: "curso não encontrado" });
    const ent = v.body.entidadeResponsavelId;
    if (ent != null && !(await repo.entidadeExiste(db, ent))) return reply.code(400).send({ error: "Entidade responsável inexistente." });
    const renomeia = Boolean(v.body.nome && v.body.nome !== antes.nome);
    // Curso e nome escrito nas tabelas do regime mudam juntos (ou nada muda).
    const ok = await db.tx(async q => {
      if (renomeia) {
        await repo.trancarNomesCursos(q, "gold");
        if (await repo.nomeCursoOcupado(q, "gold", v.body.nome!, v.params.id)) return false;
      }
      await repo.actualizarCursoGold(q, v.params.id, v.body);
      if (ent !== undefined) await repo.definirEntidadeCurso(q, v.params.id, ent);
      if (renomeia) await propagarCursoNoRegime(q, "gold", antes.nome, v.body.nome!);
      return true;
    });
    if (!ok) return reply.code(409).send({ error: NOME_REPETIDO });
    await audit(db, req.actor?.id, "curso.editar", "curso", String(v.params.id), req.ip, { regime: "gold", campos: Object.keys(v.body) });
    return { curso: await repo.obterCurso(db, "gold", v.params.id) };
  });

  app.post("/v1/cursos-fin", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = cursoFinSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Preencha código UFCD, designação, nome comercial, modalidade e horas." });
    const nome = parsed.data.nomeComercial;
    const id = await db.tx(async q => {
      await repo.trancarNomesCursos(q, "fin");
      if (await repo.nomeCursoOcupado(q, "fin", nome)) return null;
      const novo = await repo.proximoId(q);
      await repo.criarCursoFin(q, novo, parsed.data);
      return novo;
    });
    if (id == null) return reply.code(409).send({ error: NOME_REPETIDO });
    await audit(db, req.actor?.id, "curso.criar", "curso", String(id), req.ip, { regime: "fin", nome: parsed.data.nomeComercial });
    return { curso: await repo.obterCurso(db, "fin", id) };
  });

  app.patch("/v1/cursos-fin/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idParam, body: cursoFinSchema.partial() }, req);
    if (!v) return;
    const antes = await repo.obterCursoFin(db, v.params.id);
    if (!antes) return reply.code(404).send({ error: "curso não encontrado" });
    const d = v.body;
    const renomeia = Boolean(d.nomeComercial && d.nomeComercial !== antes.nomeComercial);
    const ok = await db.tx(async q => {
      if (renomeia) {
        await repo.trancarNomesCursos(q, "fin");
        if (await repo.nomeCursoOcupado(q, "fin", d.nomeComercial!, v.params.id)) return false;
      }
      await repo.actualizarCursoFin(q, v.params.id, d);
      if (renomeia) await propagarCursoNoRegime(q, "fin", antes.nomeComercial, d.nomeComercial!);
      if (d.ufcd && d.ufcd !== antes.ufcd && antes.ufcd !== antes.nomeComercial && antes.ufcd !== (d.nomeComercial ?? antes.nomeComercial)) {
        await propagarCursoNoRegime(q, "fin", antes.ufcd, d.ufcd);
      }
      return true;
    });
    if (!ok) return reply.code(409).send({ error: NOME_REPETIDO });
    await audit(db, req.actor?.id, "curso.editar", "curso", String(v.params.id), req.ip, { regime: "fin", campos: Object.keys(d) });
    return { curso: await repo.obterCurso(db, "fin", v.params.id) };
  });

  for (const regime of ["gold", "fin"] as const) {
    app.delete(`/v1/cursos-${regime}/:id`, async (req, reply) => {
      if (!requireAuth(req, reply)) return;
      const v = validar(reply, { params: idParam }, req);
      if (!v) return;
      const bloqueio = regime === "gold" ? await bloqueioCursoGold(db, v.params.id) : await bloqueioCursoFin(db, v.params.id);
      if (bloqueio) return reply.code(409).send({ error: bloqueio });
      await repo.apagarCurso(db, regime, v.params.id);
      await audit(db, req.actor?.id, "curso.apagar", "curso", String(v.params.id), req.ip, { regime });
      return { ok: true };
    });
  }

  // ── Ficha (site, programa, critérios) ─────────────────────────────────────
  app.get("/v1/cursos/:regime/fichas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: regimeParam }, req);
    if (!v) return;
    const linhas = await repo.listarFichas(db, v.params.regime);
    return {
      fichas: linhas.map(r => ({ cursoId: Number(r.curso_id), payload: fichaParaPapel(asObj(r.payload), req.actor!.role), criterios: asArr(r.criterios) })),
    };
  });

  app.get("/v1/cursos/:regime/:id/ficha", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idsCurso }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const found = await repo.lerFicha(db, regime, id);
    if (!found) return { ficha: null };
    const urls = await urlsImagemDoCurso(db, regime, id);
    const payload = semIdNaMedia(asObj(found.payload), urls);
    return { ficha: { payload: fichaParaPapel(payload, req.actor!.role), criterios: asArr(found.criterios) } };
  });

  app.put("/v1/cursos/:regime/:id/ficha", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idsCurso, body: fichaSchema }, req);
    if (!v) return;
    const { regime, id } = v.params;
    let payload = (v.body.payload ?? null) as Record<string, unknown> | null;
    if (payload && req.actor!.role !== "admin" && req.actor!.role !== "secretaria") {
      const antigo = asObj((await repo.lerFicha(db, regime, id))?.payload);
      payload = { ...payload, valoresFormador: antigo.valoresFormador ?? [] };
    }
    if (payload) payload = semIdNaMedia(payload, await urlsImagemDoCurso(db, regime, id));
    // E-learning: síncrono tem aulas online na Sala Virtual; assíncrono é só o Moodle («Aprendizagem à distância»).
    const localFixo = payload ? localDoElearning(payload.regime, payload.regimeSincronia) : null;
    if (payload && localFixo) {
      payload = { ...payload, locais: [localFixo] };
      const existe = (await listarItens(db, "locais", regime)).some(l => String(l.payload.nome ?? "").trim().toLowerCase() === localFixo.toLowerCase());
      if (!existe) {
        await criarItem(db, await proximoIdCatalogo(db), "locais", regime, { nome: localFixo, morada: moradaDoLocalElearning(localFixo), salas: 0, status: "Ativo" });
      }
    }
    await repo.gravarFicha(db, regime, id, payload, v.body.criterios ?? null);
    // Os planos de sessão da ficha passam para as turmas abertas do curso (só nas sessões ainda sem plano).
    const planosImportados = payload ? await importarParaTurmasDoCurso(db, regime, id).catch(() => 0) : 0;
    await audit(db, req.actor?.id, "curso.ficha", "curso", String(id), req.ip, { regime, planosImportados });
    return { ok: true, planosImportados };
  });

  app.post("/v1/cursos/:regime/:id/imagem/:slot", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: imagemParam }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const slot = slotImagem(v.params.slot);
    if (!slot) return reply.code(400).send({ error: "pedido inválido" });
    let lido: Awaited<ReturnType<typeof lerMultipart>>;
    try { lido = await lerMultipart(req); } catch { return reply.code(400).send({ error: "upload inválido" }); }
    if (!lido.ficheiro?.bytes.length) return reply.code(400).send({ error: "ficheiro em falta" });
    try {
      const gravada = await guardarImagemCurso(db, regime, id, slot, lido.ficheiro);
      await audit(db, req.actor?.id, "curso.imagem", "curso", String(id), req.ip, { regime, slot });
      return gravada;
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "upload recusado" });
    }
  });

  // ── Dossiê do curso (ficheiros por requisito) ─────────────────────────────
  app.get("/v1/cursos/:regime/:id/documentos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idsCurso }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const pack = await packDoCurso(db, regime, id);
    const estrutura = dtpEstrutura(regime, pack.efectivo);
    const pessoas = await repo.pessoasDoCurso(db, regime, id);
    return {
      fases: DTP_FASES,
      requisitos: estrutura.map(d => ({ id: d.id, fase: d.fase, label: d.label, universal: Boolean(d.universal) })),
      formandos: pessoas.formandos,
      formadores: pessoas.formadores,
      ficheiros: await repo.listarFicheiros(db, regime, id),
    };
  });

  app.post("/v1/cursos/:regime/:id/documentos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idsCurso }, req);
    if (!v) return;
    const { regime, id } = v.params;
    let lido: Awaited<ReturnType<typeof lerMultipart>>;
    try { lido = await lerMultipart(req); } catch { return reply.code(400).send({ error: "upload inválido" }); }
    if (!lido.ficheiro) return reply.code(400).send({ error: "ficheiro em falta" });
    const ambito = lido.campos.ambito || "curso";
    const requisitoId = (lido.campos.requisitoId ?? "").slice(0, 80);
    if (ambito !== "curso" && ambito !== "formando" && ambito !== "formador") return reply.code(400).send({ error: "Âmbito inválido." });
    const pack = await packDoCurso(db, regime, id);
    if (!requisitoId || !dtpEstrutura(regime, pack.efectivo).some(d => d.id === requisitoId)) {
      return reply.code(400).send({ error: "Associe o ficheiro a um requisito do dossiê." });
    }
    const pessoas = await repo.pessoasDoCurso(db, regime, id);
    let pessoaId: number | null = null;
    let pessoaNome = "";
    if (ambito === "formando") {
      const hit = pessoas.formandos.find(f => f.id === Number(lido.campos.pessoaId));
      if (!hit) return reply.code(400).send({ error: "Escolha o formando." });
      pessoaId = hit.id; pessoaNome = hit.nome;
    } else if (ambito === "formador") {
      const alvo = (lido.campos.pessoaNome ?? "").trim().toLowerCase();
      const hit = pessoas.formadores.find(f => f.nome.trim().toLowerCase() === alvo);
      if (!hit) return reply.code(400).send({ error: "Escolha o formador." });
      pessoaId = hit.id; pessoaNome = hit.nome;
    }
    try {
      const file = await storeDriveFile(db, req.actor!.id, { name: lido.ficheiro.nome, mime: lido.ficheiro.mime, bytes: lido.ficheiro.bytes }, {
        kind: "curso-doc", regime, label: requisitoId, formando: pessoaNome, itemId: String(id),
      });
      const ficheiroId = randomBytes(12).toString("base64url");
      await repo.substituirFicheiro(db, {
        id: ficheiroId, regime, cursoId: id, ambito, requisitoId, pessoaId, pessoaNome, nome: file.name, driveFileId: file.id, driveUrl: file.openUrl ?? "",
      });
      await audit(db, req.actor?.id, "curso.documento", "curso", String(id), req.ip, { regime, ambito, requisitoId });
      return { ok: true, id: ficheiroId, nome: file.name };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "upload recusado" });
    }
  });

  app.delete("/v1/cursos/:regime/:id/documentos/:ficheiroId", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: ficheiroParam }, req);
    if (!v) return;
    await repo.apagarFicheiro(db, v.params.regime, v.params.id, v.params.ficheiroId);
    await audit(db, req.actor?.id, "curso.documento.apagar", "curso", String(v.params.id), req.ip, { regime: v.params.regime });
    return { ok: true };
  });

  // ── Documentos pedidos na pré-inscrição ───────────────────────────────────
  async function docPreActivo(regime: "gold" | "fin", cursoId: number, docId: string) {
    if (!cursoPedeDocsPreinscricao(regime, await repo.tipoDoCurso(db, regime, cursoId))) return false;
    const cfg = await lerDocsPreinscricao(db, regime, cursoId);
    const ocultos = new Set(cfg.ocultos);
    if (docsBase(regime).some(d => d.id === docId && !ocultos.has(d.id))) return true;
    return cfg.extra.some(d => d.id === docId);
  }

  app.get("/v1/cursos/:regime/:id/docs-preinscricao", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idsCurso }, req);
    if (!v) return;
    const { regime, id } = v.params;
    const tipo = await repo.tipoDoCurso(db, regime, id);
    const aplica = cursoPedeDocsPreinscricao(regime, tipo);
    if (!aplica) return { aplica: false, tipo, docs: [] };
    const cfg = await lerDocsPreinscricao(db, regime, id);
    const ocultos = new Set(cfg.ocultos);
    const modelo = (await packDoCurso(db, regime, id)).efectivo;
    const base = docsBase(regime);
    const docs = [
      ...base.map(d => ({ id: d.id, label: d.label, required: d.required, pedido: !ocultos.has(d.id), origem: "base" as const })),
      ...cfg.extra.map(d => ({ id: d.id, label: d.label, required: d.required, pedido: true, origem: "extra" as const })),
      ...modelo.extra
        .filter(d => d.ambito === "formando")
        .filter(d => !cfg.extra.some(x => x.id === d.id) && !base.some(b => b.id === d.id))
        .map(d => ({ id: d.id, label: d.label, required: Boolean(d.bloqueante), pedido: true, origem: "dossie" as const })),
    ];
    const porNome = new Map((await listarModelosConsentimento(db, regime, id)).map(m => [m.requisito_id, m.nome]));
    return { aplica, tipo, docs: docs.map(d => ({ ...d, modelo: porNome.get(d.id) ?? "" })) };
  });

  app.put("/v1/cursos/:regime/:id/docs-preinscricao", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: idsCurso, body: docsPreSchema }, req);
    if (!v) return;
    const { regime, id } = v.params;
    if (!cursoPedeDocsPreinscricao(regime, await repo.tipoDoCurso(db, regime, id))) {
      return reply.code(400).send({ error: "Este curso não pede documentos na pré-inscrição." });
    }
    const baseIds = new Set(docsBase(regime).map(d => d.id));
    const ocultos = [...new Set(v.body.ocultos.filter(x => baseIds.has(x)))];
    const usados = new Set(baseIds);
    const extra = v.body.extra.map(item => {
      let docId = (item.id ?? "").trim();
      if (!docId || baseIds.has(docId)) docId = slugDoc(item.label);
      const raiz = docId;
      for (let n = 2; usados.has(docId); n += 1) docId = `${raiz}-${n}`;
      usados.add(docId);
      return { id: docId, label: item.label, required: item.required };
    });
    await gravarDocsPreinscricao(db, regime, id, { ocultos, extra });
    const activos = [...docsBase(regime).filter(d => !ocultos.includes(d.id)).map(d => d.id), ...extra.map(d => d.id)];
    await limparModelosFora(db, regime, id, activos);
    await audit(db, req.actor?.id, "curso.docs_preinscricao", "curso", String(id), req.ip, { regime, extra: extra.length });
    return { ok: true };
  });

  app.post("/v1/cursos/:regime/:id/docs-preinscricao/:docId/modelo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: docParam }, req);
    if (!v) return;
    const { regime, id, docId } = v.params;
    if (!(await docPreActivo(regime, id, docId))) return reply.code(400).send({ error: "Este documento não faz parte da pré-inscrição do curso." });
    let lido: Awaited<ReturnType<typeof lerMultipart>>;
    try { lido = await lerMultipart(req); } catch { return reply.code(400).send({ error: "upload inválido" }); }
    if (!lido.ficheiro) return reply.code(400).send({ error: "ficheiro em falta" });
    try {
      const file = await storeDriveFile(db, req.actor!.id, { name: lido.ficheiro.nome, mime: lido.ficheiro.mime, bytes: lido.ficheiro.bytes }, {
        kind: "curso-doc", regime, label: `consentimento-${docId}`, itemId: String(id),
      });
      await repo.substituirFicheiro(db, {
        id: randomBytes(12).toString("base64url"), regime, cursoId: id, ambito: "consentimento", requisitoId: docId,
        pessoaId: null, pessoaNome: "", nome: file.name, driveFileId: file.id, driveUrl: file.openUrl ?? "",
      });
      await audit(db, req.actor?.id, "curso.consentimento", "curso", String(id), req.ip, { regime, docId });
      return { ok: true, nome: file.name };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "upload recusado" });
    }
  });

  app.delete("/v1/cursos/:regime/:id/docs-preinscricao/:docId/modelo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const v = validar(reply, { params: docParam }, req);
    if (!v) return;
    await repo.apagarModeloConsentimento(db, v.params.regime, v.params.id, v.params.docId);
    await audit(db, req.actor?.id, "curso.consentimento.apagar", "curso", String(v.params.id), req.ip, { regime: v.params.regime, docId: v.params.docId });
    return { ok: true };
  });
}
