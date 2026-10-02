import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { listDriveFiles, readDriveContent, storeDriveFile } from "./googleDrive.js";
import { DTP_CATEGORIAS, dtpCategoriaDe, dtpCategoriaPasta, dtpPastaNome, dtpZipNome, dtpZipRelPath, pastaSegura } from "./dtpPasta.js";
import { zipStore } from "./zipStore.js";
import {
  buildDtpItems,
  comporModelo,
  dtpDefs,
  dtpEstrutura,
  dtpPct,
  estadoPorFicheirosCurso,
  parseDtpModelo,
  DTP_FASES,
  DTP_MODELO_VAZIO,
  type CursoFicheiroRef,
  type DtpCounts,
  type DtpEstado,
  type DtpFacts,
  type DtpModelo,
} from "./dtpModel.js";

type Regime = "gold" | "fin";

function pgIntArray(ids: number[]) {
  return `{${ids.filter(n => Number.isFinite(n)).map(n => Math.trunc(Number(n))).join(",")}}`;
}

function pgTextArray(values: string[]) {
  const body = values
    .map(v => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",");
  return `{${body}}`;
}

const regimeSchema = z.enum(["gold", "fin"]);
const estadoSchema = z.enum(["ok", "parcial", "falta"]);

const momentoSchema = z.object({
  conteudo: z.string().max(4000).default(""),
  atividades: z.string().max(4000).default(""),
  metodos: z.string().max(2000).default(""),
  avaliacao: z.string().max(2000).default(""),
  recursos: z.string().max(2000).default(""),
  materiais: z.string().max(2000).default(""),
});

const planoSchema = z.object({
  objetivosGerais: z.string().max(4000).default(""),
  objetivosEspecificos: z.string().max(4000).default(""),
  momentos: z.object({
    introducao: momentoSchema,
    desenvolvimento: momentoSchema,
    conclusao: momentoSchema,
  }),
});

const sumarioSchema = z.object({
  conteudos: z.string().max(6000).default(""),
  atividades: z.string().max(6000).default(""),
  observacoes: z.string().max(4000).default(""),
  assinado: z.boolean().default(false),
  assinadoEm: z.string().max(40).optional(),
});

const presencasSchema = z.array(z.object({
  id: z.number().int(),
  nome: z.string().max(160),
  presente: z.boolean(),
})).max(400);

const sessaoPatchSchema = z.object({
  plano: planoSchema.optional(),
  sumario: sumarioSchema.optional(),
  presencas: presencasSchema.optional(),
}).refine(v => v.plano || v.sumario || v.presencas, { message: "vazio" });

const documentoSchema = z.object({
  grupoId: z.string().min(1).max(40),
  label: z.string().min(1).max(160),
  estado: estadoSchema,
  detalhe: z.string().max(400).default(""),
  payload: z.unknown().optional(),
});

const dtpSchema = z.object({ estado: z.union([estadoSchema, z.literal("auto")]) });

const certificadoSchema = z.object({
  emitido: z.boolean().optional(),
  nota: z.number().min(0).max(20).nullable().optional(),
  elearning: z.number().int().min(0).max(100).nullable().optional(),
});

const avaliacaoNotasSchema = z.object({
  notas: z.array(z.object({
    formandoId: z.number().int(),
    moduloId: z.string().max(120).default(""),
    parametroId: z.string().min(1).max(80),
    nota: z.number().nullable(),
  })).max(4000),
});

const fichaSchema = z.object({
  payload: z.record(z.unknown()).optional(),
  criterios: z.array(z.object({ id: z.string().max(60), label: z.string().max(200) })).max(40).optional(),
}).refine(v => v.payload || v.criterios, { message: "vazio" });

const formandoDocsSchema = z.object({
  docs: z.array(z.object({
    id: z.string().min(1).max(60),
    ok: z.boolean(),
    fileName: z.string().max(240).default(""),
    data: z.string().max(40).default(""),
    driveFileId: z.string().max(80).optional().default(""),
    driveUrl: z.string().max(500).optional().default(""),
  })).max(40),
});

const notaSchema = z.object({ texto: z.string().trim().min(1).max(2000) });

const formadorDocsSchema = z.object({
  docs: z.array(z.object({
    id: z.string().min(1).max(60),
    uploaded: z.boolean(),
    fileName: z.string().max(240).default(""),
    driveFileId: z.string().max(80).optional().default(""),
    driveUrl: z.string().max(500).optional().default(""),
  })).max(40),
});

const dtpModeloSchema = z.object({
  excluidos: z.array(z.string().max(60)).max(80).default([]),
  incluidos: z.array(z.string().max(60)).max(80).optional().default([]),
  extra: z.array(z.object({
    id: z.string().max(40).optional(),
    fase: z.enum(["antes", "durante", "depois"]),
    label: z.string().trim().min(3).max(160),
    fonte: z.string().trim().max(120).optional(),
    hint: z.string().trim().max(240).optional(),
    bloqueante: z.boolean().optional(),
    ambito: z.enum(["turma", "formando", "formador"]).optional().default("turma"),
  })).max(30).default([]),
});

function normalizarExtras(
  extra: { id?: string; fase: "antes" | "durante" | "depois"; label: string; fonte?: string; hint?: string; bloqueante?: boolean; ambito?: "turma" | "formando" | "formador" }[],
  fonteDefault: string,
) {
  const usados = new Set<string>();
  return extra
    .map(x => ({
      id: (x.id?.trim() || slugExtra(x.label)).slice(0, 40),
      fase: x.fase,
      label: x.label.trim(),
      fonte: (x.fonte?.trim() || fonteDefault).slice(0, 120),
      hint: (x.hint?.trim() || "").slice(0, 240),
      bloqueante: Boolean(x.bloqueante),
      ambito: x.ambito ?? "turma" as const,
    }))
    .filter(x => {
      if (!x.id || !x.label || usados.has(x.id)) return false;
      usados.add(x.id);
      return true;
    });
}

function idsBase(regime: Regime, ids: string[], opts?: { extras?: boolean }) {
  const travados = new Set(dtpDefs(regime).filter(d => d.obrigatorio).map(d => d.id));
  const conhecidos = new Set(dtpDefs(regime).map(d => d.id));
  return [...new Set(ids)].filter(x => {
    if (x.startsWith("extra:")) return Boolean(opts?.extras) && x.length > "extra:".length;
    return conhecidos.has(x) && !travados.has(x);
  });
}

function slugExtra(label: string) {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

const respostaSchema = z.object({
  turma: z.string().max(120).default(""),
  formando: z.string().max(160).default(""),
  respostas: z.record(z.unknown()),
});

function asObj(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : {};
    } catch { return {}; }
  }
  return {};
}

function asArr(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v) as unknown;
      return Array.isArray(p) ? p : [];
    } catch { return []; }
  }
  return [];
}

function planoPreenchido(plano: unknown) {
  const p = asObj(plano);
  if (String(p.objetivosGerais ?? "").trim()) return true;
  const momentos = asObj(p.momentos);
  return Object.values(momentos).some(m => String(asObj(m).conteudo ?? "").trim().length > 0);
}

function pipCounts(payload: unknown): DtpCounts | null {
  const items = asArr(payload);
  if (!items.length) return null;
  const done = items.filter(i => String(asObj(i).fileName ?? "").trim()).length;
  return { done, total: items.length };
}

function simCounts(payload: unknown): DtpCounts | null {
  const items = asArr(payload);
  if (!items.length) return null;
  const done = items.filter(i => {
    const it = asObj(i);
    if (!String(it.videoName ?? "").trim()) return false;
    const notas = asObj(it.notas);
    const vals = Object.values(notas);
    return vals.length > 0 && vals.every(v => typeof v === "number" && Number.isFinite(v));
  }).length;
  return { done, total: items.length };
}

type TurmaRow = { id: number; nome: string; curso: string; cronograma: unknown; formador?: string };

async function loadTurma(db: Db, regime: Regime, id: number): Promise<TurmaRow | null> {
  const table = regime === "gold" ? "turmas_gold" : "turmas_fin";
  const row = await db.query<TurmaRow>(`SELECT id, nome, curso, cronograma, formador FROM ${table} WHERE id = $1`, [id]);
  return row.rows[0] ?? null;
}

function uniqueZipPath(used: Set<string>, path: string) {
  if (!used.has(path)) {
    used.add(path);
    return path;
  }
  const i = path.lastIndexOf(".");
  const base = i > 0 ? path.slice(0, i) : path;
  const ext = i > 0 ? path.slice(i) : "";
  let n = 2;
  while (used.has(`${base}-${n}${ext}`)) n += 1;
  const next = `${base}-${n}${ext}`;
  used.add(next);
  return next;
}

function nomeArquivoDtp(label: string | undefined, original: string) {
  const orig = pastaSegura(original || "ficheiro.pdf");
  if (!label) return orig;
  if (orig.toLowerCase().includes(label.toLowerCase().slice(0, 16))) return orig;
  return pastaSegura(`${label} - ${orig}`);
}

/** O curso da turma é texto: resolve-se pelo nome (Gold) ou pela UFCD / nome comercial (Financiada). */
async function cursoIdDaTurma(db: Db, regime: Regime, curso: string) {
  if (!curso.trim()) return null;
  const row = regime === "gold"
    ? await db.query<{ id: number }>("SELECT id FROM cursos_gold WHERE nome = $1 LIMIT 1", [curso])
    : await db.query<{ id: number }>(
      "SELECT id FROM cursos_fin WHERE ufcd = $1 OR nome_comercial = $1 LIMIT 1",
      [curso],
    );
  return row.rows[0]?.id ?? null;
}

function mapModelo(row: { excluidos: unknown; extra: unknown; incluidos?: unknown } | undefined): DtpModelo {
  return parseDtpModelo(row);
}

async function loadModelo(db: Db, regime: Regime, cursoId: number | null): Promise<DtpModelo> {
  if (cursoId == null) return DTP_MODELO_VAZIO;
  const row = await db.query<{ excluidos: unknown; extra: unknown; incluidos: unknown }>(
    "SELECT excluidos, extra, incluidos FROM curso_dtp_modelos WHERE regime = $1 AND curso_id = $2",
    [regime, cursoId],
  );
  return mapModelo(row.rows[0]);
}

type EntidadeDtp = { id: number; nome: string; modelo: DtpModelo };

async function entidadeDoCurso(db: Db, cursoId: number | null): Promise<EntidadeDtp | null> {
  if (cursoId == null) return null;
  const row = await db.query<{ id: number; nome: string; excluidos: unknown; extra: unknown }>(
    `SELECT e.id, e.nome, e.excluidos, e.extra
       FROM cursos_gold c
       JOIN dtp_entidades e ON e.id = c.entidade_responsavel_id
      WHERE c.id = $1`,
    [cursoId],
  );
  const found = row.rows[0];
  if (!found) return null;
  return { id: Number(found.id), nome: String(found.nome ?? ""), modelo: mapModelo(found) };
}

async function packDoCurso(db: Db, regime: Regime, cursoId: number | null) {
  const curso = await loadModelo(db, regime, cursoId);
  if (regime !== "gold") return { curso, entidade: null as EntidadeDtp | null, efectivo: curso };
  const entidade = await entidadeDoCurso(db, cursoId);
  return {
    curso,
    entidade,
    efectivo: comporModelo(entidade?.modelo ?? DTP_MODELO_VAZIO, curso),
  };
}

async function modeloDaTurma(db: Db, regime: Regime, turma: TurmaRow) {
  const cursoId = await cursoIdDaTurma(db, regime, turma.curso);
  const pack = await packDoCurso(db, regime, cursoId);
  return { modelo: pack.efectivo, entidade: pack.entidade?.nome ?? null };
}

async function formandosDaTurma(db: Db, regime: Regime, turma: TurmaRow) {
  if (regime === "gold") {
    const rows = await db.query<{ id: number; nome: string; apelido: string }>(
      "SELECT id, nome, apelido FROM formandos_gold WHERE turma_id = $1 OR turma = $2 ORDER BY nome",
      [turma.id, turma.nome],
    );
    return rows.rows.map(r => ({ id: r.id, nome: `${r.nome} ${r.apelido}`.trim(), docs: {} as Record<string, unknown> }));
  }
  // Na Financiada o campo turma é texto livre: quem não aponta para uma turma existente conta pelo curso.
  const rows = await db.query<{ id: number; nome: string; apelido: string; docs: unknown }>(
    `SELECT id, nome, apelido, docs FROM formandos_fin f
      WHERE f.turma = $1
         OR (f.curso = $2 AND NOT EXISTS (SELECT 1 FROM turmas_fin t WHERE t.nome = f.turma))
      ORDER BY nome`,
    [turma.nome, turma.curso],
  );
  return rows.rows.map(r => ({ id: r.id, nome: `${r.nome} ${r.apelido}`.trim(), docs: asObj(r.docs) }));
}

async function turmaFacts(db: Db, regime: Regime, turma: TurmaRow): Promise<DtpFacts> {
  const sessoesTotal = asArr(turma.cronograma).length;
  const [sessoesRows, docRows, certRows, formandos] = await Promise.all([
    db.query<{ sessao_n: number; plano: unknown; sumario: unknown; presencas: unknown }>(
      "SELECT sessao_n, plano, sumario, presencas FROM turma_sessoes WHERE regime = $1 AND turma_id = $2",
      [regime, turma.id],
    ),
    db.query<{ grupo_id: string; label: string; estado: string; detalhe: string; payload: unknown }>(
      "SELECT grupo_id, label, estado, detalhe, payload FROM turma_documentos WHERE regime = $1 AND turma_id = $2",
      [regime, turma.id],
    ),
    db.query<{ formando_id: number; emitido: boolean }>(
      "SELECT formando_id, emitido FROM turma_certificados WHERE regime = $1 AND turma_id = $2",
      [regime, turma.id],
    ),
    formandosDaTurma(db, regime, turma),
  ]);

  const planos = sessoesRows.rows.filter(r => planoPreenchido(r.plano)).length;
  const sumarios = sessoesRows.rows.filter(r => Boolean(asObj(r.sumario).assinado)).length;
  const presencas = sessoesRows.rows.filter(r => asArr(r.presencas).length > 0).length;

  const docByLabel = (re: RegExp) => docRows.rows.find(d => re.test(d.label));
  const pip = pipCounts(docByLabel(/^pip$/i)?.payload ?? docByLabel(/pip/i)?.payload);
  const simIni = simCounts(docRows.rows.find(d => /simula/i.test(d.label) && /inicial/i.test(d.label))?.payload);
  const simFim = simCounts(docRows.rows.find(d => /simula/i.test(d.label) && /final/i.test(d.label))?.payload);

  const docs: Record<string, DtpCounts> = {};
  const total = formandos.length;
  if (total > 0) {
    const ids = formandos.map(f => f.id);
    if (regime === "fin") {
      for (const key of ["cc", "ch", "cu", "ci", "ce"]) {
        const done = formandos.filter(f => Boolean(asObj(f.docs[key]).ok)).length;
        docs[key] = { done, total };
      }
    }
    const rows = ids.length
      ? await db.query<{ doc_id: string; n: number }>(
        `SELECT doc_id, count(*)::int AS n FROM formando_docs
           WHERE regime = $1 AND ok = true AND formando_id = ANY($2::int[])
           GROUP BY doc_id`,
        [regime, pgIntArray(ids)],
      )
      : { rows: [] as { doc_id: string; n: number }[] };
    for (const r of rows.rows) docs[r.doc_id] = { done: Number(r.n) || 0, total };
    const bases = regime === "gold" ? ["cc", "contrato", "pip", "exp", "regulamento"] : ["cc", "ch", "cu", "ci", "ce"];
    for (const key of bases) docs[key] ??= { done: 0, total };
  }

  return {
    sessoes: { done: sessoesTotal, total: sessoesTotal },
    planos: { done: planos, total: sessoesTotal },
    sumarios: { done: sumarios, total: sessoesTotal },
    presencas: { done: presencas, total: sessoesTotal },
    formandos: total,
    certificados: { done: certRows.rows.filter(r => r.emitido).length, total },
    contratos: docs.contrato ?? { done: 0, total },
    pip,
    simInicial: simIni,
    simFinal: simFim,
    docs,
  };
}

async function manualDtp(db: Db, regime: Regime, turmaId: number) {
  const rows = await db.query<{ item_id: string; estado: DtpEstado }>(
    "SELECT item_id, estado FROM turma_dtp WHERE regime = $1 AND turma_id = $2",
    [regime, turmaId],
  );
  return Object.fromEntries(rows.rows.map(r => [r.item_id, r.estado])) as Record<string, DtpEstado>;
}

async function dtpForTurma(db: Db, regime: Regime, turma: TurmaRow, modeloPre?: DtpModelo, entidadePre?: string | null) {
  const carregado = modeloPre
    ? { modelo: modeloPre, entidade: entidadePre ?? null }
    : await modeloDaTurma(db, regime, turma);
  const modelo = carregado.modelo;
  const [facts, manual, anexos] = await Promise.all([
    turmaFacts(db, regime, turma),
    manualDtp(db, regime, turma.id),
    db.query<{ item_id: string; drive_file_id: string; file_name: string; drive_url: string }>(
      "SELECT item_id, drive_file_id, file_name, drive_url FROM dtp_anexos WHERE regime = $1 AND turma_id = $2",
      [regime, turma.id],
    ).catch(() => ({ rows: [] as { item_id: string; drive_file_id: string; file_name: string; drive_url: string }[] })),
  ]);
  const byItem = new Map(anexos.rows.map(r => [r.item_id, r]));
  const cursoId = await cursoIdDaTurma(db, regime, turma.curso);
  const ficheiroRows = cursoId == null
    ? []
    : (await db.query<{ ambito: string; requisito_id: string; pessoa_id: number | null; pessoa_nome: string }>(
      `SELECT ambito, requisito_id, pessoa_id, pessoa_nome
         FROM curso_ficheiros
        WHERE regime = $1 AND curso_id = $2 AND requisito_id <> ''`,
      [regime, cursoId],
    ).catch(() => ({ rows: [] as { ambito: string; requisito_id: string; pessoa_id: number | null; pessoa_nome: string }[] }))).rows;
  const refs: CursoFicheiroRef[] = ficheiroRows.map(f => ({
    ambito: f.ambito,
    requisitoId: f.requisito_id,
    pessoaId: f.pessoa_id,
    pessoaNome: f.pessoa_nome,
  }));
  const formandosCurso = refs.some(f => f.ambito === "formando") ? await formandosDaTurma(db, regime, turma) : [];
  const items = buildDtpItems(regime, facts, manual, modelo).map(item => {
    const a = byItem.get(item.id);
    const anexo = a?.drive_file_id
      ? { fileName: a.file_name, url: a.drive_url, driveFileId: a.drive_file_id }
      : null;
    let next = item;
    if (anexo && item.origem === "manual" && item.estado === "falta") {
      next = { ...item, estado: "ok" as const, detalhe: `Ficheiro no Drive: ${anexo.fileName}` };
    }
    const porPartes = estadoPorFicheirosCurso(next.id, refs, formandosCurso, turma.formador ?? "");
    if (porPartes?.estado === "ok") {
      return { ...next, anexo, estado: "ok" as const, detalhe: porPartes.detalhe };
    }
    if (porPartes?.estado === "parcial" && next.estado !== "ok") {
      return { ...next, anexo, estado: "parcial" as const, detalhe: porPartes.detalhe };
    }
    return { ...next, anexo };
  });
  return {
    items,
    pct: dtpPct(items),
    ok: items.filter(i => i.estado === "ok").length,
    parcial: items.filter(i => i.estado === "parcial").length,
    falta: items.filter(i => i.estado === "falta").length,
    total: items.length,
    facts,
    entidade: carregado.entidade,
  };
}

export async function dtpResumo(db: Db, regime: Regime) {
  const table = regime === "gold" ? "turmas_gold" : "turmas_fin";
  const [rows, modelos, entidades, ligacoes] = await Promise.all([
    db.query<TurmaRow>(`SELECT id, nome, curso, cronograma, formador FROM ${table}`),
    db.query<{ curso_id: number; excluidos: unknown; extra: unknown; incluidos: unknown }>(
      "SELECT curso_id, excluidos, extra, incluidos FROM curso_dtp_modelos WHERE regime = $1",
      [regime],
    ),
    regime === "gold"
      ? db.query<{ id: number; excluidos: unknown; extra: unknown }>("SELECT id, excluidos, extra FROM dtp_entidades")
      : Promise.resolve({ rows: [] as { id: number; excluidos: unknown; extra: unknown }[] }),
    regime === "gold"
      ? db.query<{ id: number; entidade_responsavel_id: number | null }>(
        "SELECT id, entidade_responsavel_id FROM cursos_gold",
      )
      : Promise.resolve({ rows: [] as { id: number; entidade_responsavel_id: number | null }[] }),
  ]);
  const porCurso = new Map<number, DtpModelo>(modelos.rows.map(r => [Number(r.curso_id), mapModelo(r)]));
  const porEntidade = new Map<number, DtpModelo>(entidades.rows.map(r => [Number(r.id), mapModelo(r)]));
  const entidadePorCurso = new Map<number, number>();
  for (const lig of ligacoes.rows) {
    if (lig.entidade_responsavel_id != null) entidadePorCurso.set(Number(lig.id), Number(lig.entidade_responsavel_id));
  }
  const out: Record<number, number> = {};
  for (const turma of rows.rows) {
    const cursoId = await cursoIdDaTurma(db, regime, turma.curso);
    const curso = cursoId != null ? porCurso.get(cursoId) ?? DTP_MODELO_VAZIO : DTP_MODELO_VAZIO;
    const entidadeId = cursoId != null ? entidadePorCurso.get(cursoId) : undefined;
    const entidade = entidadeId != null ? porEntidade.get(entidadeId) ?? DTP_MODELO_VAZIO : DTP_MODELO_VAZIO;
    const modelo = regime === "gold" ? comporModelo(entidade, curso) : curso;
    const dtp = await dtpForTurma(db, regime, turma, modelo, null);
    out[turma.id] = dtp.pct;
  }
  return out;
}

export function registerPedagogiaRoutes(
  app: FastifyInstance,
  db: Db,
  helpers: {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => boolean;
    audit: (db: Db, actorId: string | undefined, action: string, entity: string, entityId?: string, ip?: string, meta?: Record<string, unknown>) => Promise<void>;
  },
) {
  const { requireAuth, audit } = helpers;

  function params(req: FastifyRequest) {
    const p = req.params as { regime?: string; id?: string; n?: string; itemId?: string; formandoId?: string };
    const regime = regimeSchema.safeParse(p.regime);
    const id = Number(p.id);
    return {
      regime: regime.success ? regime.data : null,
      id: Number.isInteger(id) ? id : null,
      n: Number(p.n),
      itemId: p.itemId ?? "",
      formandoId: Number(p.formandoId),
    };
  }

  app.get("/v1/turmas/:regime/:id/pedagogia", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id } = params(req);
    if (!regime || id == null) return reply.code(400).send({ error: "pedido inválido" });
    const turma = await loadTurma(db, regime, id);
    if (!turma) return reply.code(404).send({ error: "turma não encontrada" });

    const [sessoes, documentos, certificados, dtp] = await Promise.all([
      db.query<{ sessao_n: number; plano: unknown; sumario: unknown; presencas: unknown }>(
        "SELECT sessao_n, plano, sumario, presencas FROM turma_sessoes WHERE regime = $1 AND turma_id = $2 ORDER BY sessao_n",
        [regime, id],
      ),
      db.query<{ grupo_id: string; label: string; estado: string; detalhe: string; payload: unknown }>(
        "SELECT grupo_id, label, estado, detalhe, payload FROM turma_documentos WHERE regime = $1 AND turma_id = $2",
        [regime, id],
      ),
      db.query<{ formando_id: number; emitido: boolean; nota: unknown; elearning: unknown }>(
        "SELECT formando_id, emitido, nota, elearning FROM turma_certificados WHERE regime = $1 AND turma_id = $2",
        [regime, id],
      ),
      dtpForTurma(db, regime, turma),
    ]);

    return {
      sessoes: sessoes.rows.map(r => ({
        n: r.sessao_n,
        plano: r.plano ? asObj(r.plano) : null,
        sumario: r.sumario ? asObj(r.sumario) : null,
        presencas: asArr(r.presencas),
      })),
      documentos: documentos.rows.map(r => ({
        grupoId: r.grupo_id,
        label: r.label,
        estado: r.estado,
        detalhe: r.detalhe,
        payload: r.payload ?? null,
      })),
      certificados: certificados.rows.map(r => ({
        formandoId: r.formando_id,
        emitido: r.emitido,
        nota: r.nota == null ? null : Number(r.nota),
        elearning: r.elearning == null ? null : Number(r.elearning),
      })),
      dtp,
    };
  });

  app.put("/v1/turmas/:regime/:id/sessoes/:n", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id, n } = params(req);
    const parsed = sessaoPatchSchema.safeParse(req.body);
    if (!regime || id == null || !Number.isInteger(n) || n < 1 || !parsed.success) {
      return reply.code(400).send({ error: "pedido inválido" });
    }
    const patch = parsed.data;
    await db.query(
      `INSERT INTO turma_sessoes (regime, turma_id, sessao_n, plano, sumario, presencas)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, COALESCE($6::jsonb, '[]'::jsonb))
       ON CONFLICT (regime, turma_id, sessao_n) DO UPDATE SET
         plano = COALESCE($4::jsonb, turma_sessoes.plano),
         sumario = COALESCE($5::jsonb, turma_sessoes.sumario),
         presencas = COALESCE($6::jsonb, turma_sessoes.presencas),
         updated_at = now()`,
      [
        regime,
        id,
        n,
        patch.plano ?? null,
        patch.sumario ?? null,
        patch.presencas ?? null,
      ],
    );
    const acao = patch.plano ? "turma.plano" : patch.sumario ? "turma.sumario" : "turma.presencas";
    await audit(db, req.actor!.id, acao, "turma", String(id), req.ip, { regime, sessao: n });
    const row = await db.query<{ plano: unknown; sumario: unknown; presencas: unknown }>(
      "SELECT plano, sumario, presencas FROM turma_sessoes WHERE regime = $1 AND turma_id = $2 AND sessao_n = $3",
      [regime, id, n],
    );
    const saved = row.rows[0];
    return {
      sessao: {
        n,
        plano: saved?.plano ? asObj(saved.plano) : null,
        sumario: saved?.sumario ? asObj(saved.sumario) : null,
        presencas: asArr(saved?.presencas),
      },
    };
  });

  app.put("/v1/turmas/:regime/:id/documentos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id } = params(req);
    const parsed = documentoSchema.safeParse(req.body);
    if (!regime || id == null || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const doc = parsed.data;
    await db.query(
      `INSERT INTO turma_documentos (regime, turma_id, grupo_id, label, estado, detalhe, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
       ON CONFLICT (regime, turma_id, grupo_id, label) DO UPDATE SET
         estado = EXCLUDED.estado,
         detalhe = EXCLUDED.detalhe,
         payload = COALESCE(EXCLUDED.payload, turma_documentos.payload),
         updated_at = now()`,
      [regime, id, doc.grupoId, doc.label, doc.estado, doc.detalhe, doc.payload === undefined ? null : doc.payload],
    );
    await audit(db, req.actor!.id, "turma.documento", "turma", String(id), req.ip, { regime, label: doc.label, estado: doc.estado });
    return { ok: true };
  });

  app.put("/v1/turmas/:regime/:id/dtp/:itemId", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id, itemId } = params(req);
    const parsed = dtpSchema.safeParse(req.body);
    if (!regime || id == null || !itemId || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    if (parsed.data.estado === "auto") {
      await db.query("DELETE FROM turma_dtp WHERE regime = $1 AND turma_id = $2 AND item_id = $3", [regime, id, itemId]);
    } else {
      await db.query(
        `INSERT INTO turma_dtp (regime, turma_id, item_id, estado) VALUES ($1, $2, $3, $4)
         ON CONFLICT (regime, turma_id, item_id) DO UPDATE SET estado = EXCLUDED.estado, updated_at = now()`,
        [regime, id, itemId, parsed.data.estado],
      );
    }
    const turma = await loadTurma(db, regime, id);
    if (!turma) return reply.code(404).send({ error: "turma não encontrada" });
    await audit(db, req.actor!.id, "turma.dtp", "turma", String(id), req.ip, { regime, item: itemId, estado: parsed.data.estado });
    return { dtp: await dtpForTurma(db, regime, turma) };
  });

  app.put("/v1/turmas/:regime/:id/dtp/:itemId/anexo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id, itemId } = params(req);
    const parsed = z.object({
      driveFileId: z.string().min(1).max(80),
      fileName: z.string().max(240).default(""),
      driveUrl: z.string().max(500).optional().default(""),
    }).safeParse(req.body);
    if (!regime || id == null || !itemId || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    await db.query(
      `INSERT INTO dtp_anexos (regime, turma_id, item_id, drive_file_id, file_name, drive_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (regime, turma_id, item_id) DO UPDATE SET
         drive_file_id = EXCLUDED.drive_file_id, file_name = EXCLUDED.file_name,
         drive_url = EXCLUDED.drive_url, updated_at = now()`,
      [regime, id, itemId, parsed.data.driveFileId, parsed.data.fileName, parsed.data.driveUrl ?? ""],
    );
    await db.query(
      `INSERT INTO turma_dtp (regime, turma_id, item_id, estado) VALUES ($1, $2, $3, 'ok')
       ON CONFLICT (regime, turma_id, item_id) DO UPDATE SET estado = 'ok', updated_at = now()`,
      [regime, id, itemId],
    );
    const turma = await loadTurma(db, regime, id);
    if (!turma) return reply.code(404).send({ error: "turma não encontrada" });
    await audit(db, req.actor!.id, "turma.dtp_anexo", "turma", String(id), req.ip, { regime, item: itemId });
    return { dtp: await dtpForTurma(db, regime, turma) };
  });

  app.put("/v1/turmas/:regime/:id/certificados/:formandoId", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id, formandoId } = params(req);
    const parsed = certificadoSchema.safeParse(req.body);
    if (!regime || id == null || !Number.isInteger(formandoId) || !parsed.success) {
      return reply.code(400).send({ error: "pedido inválido" });
    }
    const c = parsed.data;
    await db.query(
      `INSERT INTO turma_certificados (regime, turma_id, formando_id, emitido, nota, elearning, emitido_em)
       VALUES ($1, $2, $3, COALESCE($4, false), $5, $6, CASE WHEN $4 = true THEN now() ELSE NULL END)
       ON CONFLICT (regime, turma_id, formando_id) DO UPDATE SET
         emitido = COALESCE($4, turma_certificados.emitido),
         nota = COALESCE($5, turma_certificados.nota),
         elearning = COALESCE($6, turma_certificados.elearning),
         emitido_em = CASE WHEN $4 = true THEN now() ELSE turma_certificados.emitido_em END,
         updated_at = now()`,
      [regime, id, formandoId, c.emitido ?? null, c.nota ?? null, c.elearning ?? null],
    );
    await audit(db, req.actor!.id, "turma.certificado", "formando", String(formandoId), req.ip, { regime, turma: id, emitido: c.emitido });
    return { ok: true };
  });

  app.get("/v1/turmas/:regime/:id/avaliacao", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id } = params(req);
    if (!regime || id == null) return reply.code(400).send({ error: "pedido inválido" });
    const rows = await db.query<{ formando_id: number; modulo_id: string; parametro_id: string; nota: unknown }>(
      "SELECT formando_id, modulo_id, parametro_id, nota FROM turma_avaliacoes WHERE regime = $1 AND turma_id = $2",
      [regime, id],
    ).catch(() => ({ rows: [] as { formando_id: number; modulo_id: string; parametro_id: string; nota: unknown }[] }));
    return {
      notas: rows.rows.map(r => ({
        formandoId: Number(r.formando_id),
        moduloId: r.modulo_id ?? "",
        parametroId: r.parametro_id,
        nota: r.nota == null ? null : Number(r.nota),
      })),
    };
  });

  app.put("/v1/turmas/:regime/:id/avaliacao", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id } = params(req);
    const parsed = avaliacaoNotasSchema.safeParse(req.body);
    if (!regime || id == null || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    await db.query("DELETE FROM turma_avaliacoes WHERE regime = $1 AND turma_id = $2", [regime, id]);
    for (const n of parsed.data.notas) {
      if (n.nota == null || !Number.isFinite(n.nota)) continue;
      await db.query(
        `INSERT INTO turma_avaliacoes (regime, turma_id, formando_id, modulo_id, parametro_id, nota)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [regime, id, n.formandoId, n.moduloId || "", n.parametroId, n.nota],
      );
    }
    await audit(db, req.actor!.id, "turma.avaliacao", "turma", String(id), req.ip, { regime, notas: parsed.data.notas.length });
    return { ok: true };
  });

  app.get("/v1/dtp/:regime", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime } = params(req);
    if (!regime) return reply.code(400).send({ error: "pedido inválido" });
    return { pct: await dtpResumo(db, regime) };
  });

  app.get("/v1/dtp/:regime/base", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime } = params(req);
    if (!regime) return reply.code(400).send({ error: "pedido inválido" });
    return { fases: DTP_FASES, base: dtpDefs(regime) };
  });

  function respostaModelo(regime: Regime, modelo: DtpModelo, entidade: EntidadeDtp | null) {
    const efectivo = regime === "gold" ? comporModelo(entidade?.modelo ?? DTP_MODELO_VAZIO, modelo) : modelo;
    return {
      fases: DTP_FASES,
      base: dtpDefs(regime),
      modelo,
      entidade: entidade ? { id: entidade.id, nome: entidade.nome, modelo: entidade.modelo } : null,
      efectivo,
      estrutura: dtpEstrutura(regime, efectivo),
    };
  }

  app.get("/v1/dtp/gold/entidades", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await db.query<{ id: number; nome: string; excluidos: unknown; extra: unknown }>(
      "SELECT id, nome, excluidos, extra FROM dtp_entidades ORDER BY nome",
    );
    return {
      entidades: rows.rows.map(r => ({
        id: Number(r.id),
        nome: r.nome,
        documentos: dtpEstrutura("gold", mapModelo(r)).length,
      })),
    };
  });

  app.post("/v1/dtp/gold/entidades", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = z.object({ nome: z.string().trim().min(2).max(120) }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "Indique o nome da entidade." });
    const nome = parsed.data.nome;
    const dup = await db.query<{ id: number }>(
      "SELECT id FROM dtp_entidades WHERE lower(trim(nome)) = lower(trim($1)) LIMIT 1",
      [nome],
    );
    if (dup.rows[0]) return reply.code(409).send({ error: "Já existe uma entidade com esse nome." });
    const row = await db.query<{ id: number }>(
      "INSERT INTO dtp_entidades (nome) VALUES ($1) RETURNING id",
      [nome],
    );
    const id = Number(row.rows[0]?.id);
    await audit(db, req.actor!.id, "dtp.entidade", "dtp_entidade", String(id), req.ip, { nome });
    return { entidade: { id, nome, documentos: dtpEstrutura("gold", DTP_MODELO_VAZIO).length } };
  });

  app.patch("/v1/dtp/gold/entidades/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = z.object({ nome: z.string().trim().min(2).max(120) }).safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "Indique o nome da entidade." });
    const nome = parsed.data.nome;
    const dup = await db.query<{ id: number }>(
      "SELECT id FROM dtp_entidades WHERE lower(trim(nome)) = lower(trim($1)) AND id <> $2 LIMIT 1",
      [nome, id],
    );
    if (dup.rows[0]) return reply.code(409).send({ error: "Já existe uma entidade com esse nome." });
    const row = await db.query<{ id: number; excluidos: unknown; extra: unknown }>(
      "UPDATE dtp_entidades SET nome = $2, updated_at = now() WHERE id = $1 RETURNING id, excluidos, extra",
      [id, nome],
    );
    const saved = row.rows[0];
    if (!saved) return reply.code(404).send({ error: "Entidade não encontrada." });
    await audit(db, req.actor!.id, "dtp.entidade", "dtp_entidade", String(id), req.ip, { nome });
    return { entidade: { id, nome, documentos: dtpEstrutura("gold", mapModelo(saved)).length } };
  });

  app.delete("/v1/dtp/gold/entidades/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: "pedido inválido" });
    const row = await db.query<{ id: number }>("DELETE FROM dtp_entidades WHERE id = $1 RETURNING id", [id]);
    if (!row.rows[0]) return reply.code(404).send({ error: "Entidade não encontrada." });
    await audit(db, req.actor!.id, "dtp.entidade.apagar", "dtp_entidade", String(id), req.ip);
    return { ok: true };
  });

  app.get("/v1/dtp/gold/entidades/:id/modelo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: "pedido inválido" });
    const row = await db.query<{ id: number; nome: string; excluidos: unknown; extra: unknown }>(
      "SELECT id, nome, excluidos, extra FROM dtp_entidades WHERE id = $1",
      [id],
    );
    const found = row.rows[0];
    if (!found) return reply.code(404).send({ error: "Entidade não encontrada." });
    const modelo = mapModelo(found);
    return {
      fases: DTP_FASES,
      base: dtpDefs("gold"),
      modelo,
      entidade: null,
      efectivo: modelo,
      estrutura: dtpEstrutura("gold", modelo),
    };
  });

  app.put("/v1/dtp/gold/entidades/:id/modelo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = dtpModeloSchema.safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const existe = await db.query<{ id: number }>("SELECT id FROM dtp_entidades WHERE id = $1", [id]);
    if (!existe.rows[0]) return reply.code(404).send({ error: "Entidade não encontrada." });
    const excluidos = idsBase("gold", parsed.data.excluidos);
    const extra = normalizarExtras(parsed.data.extra, "ENA · entidade responsável");
    await db.query(
      "UPDATE dtp_entidades SET excluidos = $2::jsonb, extra = $3::jsonb, updated_at = now() WHERE id = $1",
      [id, excluidos, extra],
    );
    await audit(db, req.actor!.id, "dtp.entidade.modelo", "dtp_entidade", String(id), req.ip, {
      excluidos: excluidos.length,
      extra: extra.length,
    });
    const modelo: DtpModelo = { excluidos, incluidos: [], extra };
    return { modelo, estrutura: dtpEstrutura("gold", modelo) };
  });

  app.get("/v1/cursos/:regime/:id/dtp-modelo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id } = params(req);
    if (!regime || id == null) return reply.code(400).send({ error: "pedido inválido" });
    const pack = await packDoCurso(db, regime, id);
    return respostaModelo(regime, pack.curso, pack.entidade);
  });

  app.put("/v1/cursos/:regime/:id/dtp-modelo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id } = params(req);
    const parsed = dtpModeloSchema.safeParse(req.body);
    if (!regime || id == null || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });

    const entidade = regime === "gold" ? await entidadeDoCurso(db, id) : null;
    const idsEntidade = new Set((entidade?.modelo.extra ?? []).map(x => x.id));
    const excluidos = idsBase(regime, parsed.data.excluidos, { extras: true });
    const incluidos = idsBase(regime, parsed.data.incluidos).filter(x => entidade?.modelo.excluidos.includes(x));
    const extra = normalizarExtras(parsed.data.extra, "ENA · exigência do curso").filter(x => !idsEntidade.has(x.id));

    await db.query(
      `INSERT INTO curso_dtp_modelos (regime, curso_id, excluidos, incluidos, extra)
       VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb)
       ON CONFLICT (regime, curso_id) DO UPDATE SET
         excluidos = EXCLUDED.excluidos,
         incluidos = EXCLUDED.incluidos,
         extra = EXCLUDED.extra,
         updated_at = now()`,
      [regime, id, excluidos, incluidos, extra],
    );
    await audit(db, req.actor!.id, "curso.dtp_modelo", "curso", String(id), req.ip, {
      regime,
      excluidos: excluidos.length,
      incluidos: incluidos.length,
      extra: extra.length,
    });
    const modelo: DtpModelo = { excluidos, incluidos, extra };
    return respostaModelo(regime, modelo, entidade);
  });

  async function nomesDoCurso(regime: Regime, cursoId: number) {
    if (regime === "gold") {
      const row = await db.query<{ nome: string }>("SELECT nome FROM cursos_gold WHERE id = $1", [cursoId]);
      const nome = row.rows[0]?.nome?.trim() ?? "";
      return nome ? [nome] : [];
    }
    const row = await db.query<{ ufcd: string; nome_comercial: string }>(
      "SELECT ufcd, nome_comercial FROM cursos_fin WHERE id = $1",
      [cursoId],
    );
    const found = row.rows[0];
    if (!found) return [];
    return [...new Set([found.ufcd, found.nome_comercial].map(s => s.trim()).filter(Boolean))];
  }

  async function pessoasDoCurso(regime: Regime, cursoId: number) {
    const nomes = await nomesDoCurso(regime, cursoId);
    if (!nomes.length) return { formandos: [] as { id: number; nome: string }[], formadores: [] as { id: number | null; nome: string }[] };
    const lista = pgTextArray(nomes);
    const tableF = regime === "gold" ? "formandos_gold" : "formandos_fin";
    const tableT = regime === "gold" ? "turmas_gold" : "turmas_fin";
    const [formandos, formadorNomes, catalogo] = await Promise.all([
      db.query<{ id: number; nome: string; apelido: string }>(
        `SELECT DISTINCT f.id, f.nome, f.apelido FROM ${tableF} f
          WHERE f.curso = ANY($1::text[])
             OR f.turma IN (SELECT nome FROM ${tableT} WHERE curso = ANY($1::text[]))
          ORDER BY f.nome, f.apelido`,
        [lista],
      ),
      db.query<{ formador: string }>(
        `SELECT DISTINCT trim(formador) AS formador FROM ${tableT}
          WHERE curso = ANY($1::text[]) AND trim(formador) <> ''
          ORDER BY 1`,
        [lista],
      ),
      db.query<{ id: number; nome: string }>("SELECT id, nome FROM formadores"),
    ]);
    return {
      formandos: formandos.rows.map(f => ({ id: f.id, nome: `${f.nome} ${f.apelido}`.trim() })),
      formadores: formadorNomes.rows.map(r => {
        const hit = catalogo.rows.find(c => c.nome.trim().toLowerCase() === r.formador.trim().toLowerCase());
        return { id: hit?.id ?? null, nome: hit?.nome ?? r.formador };
      }),
    };
  }

  app.get("/v1/cursos/:regime/:id/documentos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id } = params(req);
    if (!regime || id == null) return reply.code(400).send({ error: "pedido inválido" });
    const pack = await packDoCurso(db, regime, id);
    const estrutura = dtpEstrutura(regime, pack.efectivo);
    const pessoas = await pessoasDoCurso(regime, id);
    const ficheiros = await db.query<{
      id: string; ambito: string; requisito_id: string; pessoa_id: number | null; pessoa_nome: string;
      nome: string; drive_file_id: string | null; drive_url: string; created_at: string;
    }>(
      `SELECT id, ambito, requisito_id, pessoa_id, pessoa_nome, nome, drive_file_id, drive_url, created_at
         FROM curso_ficheiros WHERE regime = $1 AND curso_id = $2 ORDER BY created_at DESC`,
      [regime, id],
    );
    return {
      fases: DTP_FASES,
      requisitos: estrutura.map(d => ({ id: d.id, fase: d.fase, label: d.label, universal: Boolean(d.universal) })),
      formandos: pessoas.formandos,
      formadores: pessoas.formadores,
      ficheiros: ficheiros.rows.map(f => ({
        id: f.id,
        ambito: f.ambito,
        requisitoId: f.requisito_id,
        pessoaId: f.pessoa_id,
        pessoaNome: f.pessoa_nome,
        nome: f.nome,
        url: f.drive_url || (f.drive_file_id ? `/api/v1/drive/files/${f.drive_file_id}/content` : ""),
        createdAt: f.created_at,
      })),
    };
  });

  app.post("/v1/cursos/:regime/:id/documentos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id } = params(req);
    if (!regime || id == null) return reply.code(400).send({ error: "pedido inválido" });
    let name = "ficheiro";
    let mime = "application/octet-stream";
    let bytes: Buffer | null = null;
    let ambito = "curso";
    let requisitoId = "";
    let pessoaId: number | null = null;
    let pessoaNome = "";
    try {
      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          name = part.filename || name;
          mime = part.mimetype || mime;
          bytes = await part.toBuffer();
        } else if (part.fieldname === "ambito") ambito = String(part.value ?? "curso");
        else if (part.fieldname === "requisitoId") requisitoId = String(part.value ?? "").slice(0, 80);
        else if (part.fieldname === "pessoaId") {
          const n = Number(part.value);
          pessoaId = Number.isInteger(n) ? n : null;
        } else if (part.fieldname === "pessoaNome") pessoaNome = String(part.value ?? "").trim().slice(0, 160);
      }
    } catch {
      return reply.code(400).send({ error: "upload inválido" });
    }
    if (!bytes) return reply.code(400).send({ error: "ficheiro em falta" });
    if (ambito !== "curso" && ambito !== "formando" && ambito !== "formador") {
      return reply.code(400).send({ error: "Âmbito inválido." });
    }
    const pack = await packDoCurso(db, regime, id);
    const ids = new Set(dtpEstrutura(regime, pack.efectivo).map(d => d.id));
    if (!requisitoId || !ids.has(requisitoId)) return reply.code(400).send({ error: "Associe o ficheiro a um requisito do dossiê." });
    const pessoas = await pessoasDoCurso(regime, id);
    if (ambito === "formando") {
      const hit = pessoas.formandos.find(f => f.id === pessoaId);
      if (!hit) return reply.code(400).send({ error: "Escolha o formando." });
      pessoaNome = hit.nome;
    } else if (ambito === "formador") {
      const hit = pessoas.formadores.find(f => f.nome.trim().toLowerCase() === pessoaNome.trim().toLowerCase());
      if (!hit) return reply.code(400).send({ error: "Escolha o formador." });
      pessoaNome = hit.nome;
      pessoaId = hit.id;
    } else {
      pessoaId = null;
      pessoaNome = "";
    }
    try {
      const file = await storeDriveFile(db, req.actor!.id, { name, mime, bytes }, {
        kind: "curso-doc",
        regime,
        label: requisitoId,
        formando: pessoaNome,
        itemId: String(id),
      });
      if (ambito === "curso") {
        await db.query(
          "DELETE FROM curso_ficheiros WHERE regime = $1 AND curso_id = $2 AND ambito = 'curso' AND requisito_id = $3",
          [regime, id, requisitoId],
        );
      } else if (ambito === "formando") {
        await db.query(
          "DELETE FROM curso_ficheiros WHERE regime = $1 AND curso_id = $2 AND ambito = 'formando' AND requisito_id = $3 AND pessoa_id = $4",
          [regime, id, requisitoId, pessoaId],
        );
      } else {
        await db.query(
          "DELETE FROM curso_ficheiros WHERE regime = $1 AND curso_id = $2 AND ambito = 'formador' AND requisito_id = $3 AND lower(pessoa_nome) = lower($4)",
          [regime, id, requisitoId, pessoaNome],
        );
      }
      const ficheiroId = randomBytes(12).toString("base64url");
      await db.query(
        `INSERT INTO curso_ficheiros (id, regime, curso_id, ambito, requisito_id, pessoa_id, pessoa_nome, nome, drive_file_id, drive_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [ficheiroId, regime, id, ambito, requisitoId, pessoaId, pessoaNome, file.name, file.id, file.openUrl ?? ""],
      );
      await audit(db, req.actor!.id, "curso.documento", "curso", String(id), req.ip, { regime, ambito, requisitoId });
      return { ok: true, id: ficheiroId, nome: file.name };
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "upload recusado" });
    }
  });

  app.delete("/v1/cursos/:regime/:id/documentos/:ficheiroId", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id } = params(req);
    const ficheiroId = String((req.params as { ficheiroId?: string }).ficheiroId ?? "");
    if (!regime || id == null || !ficheiroId) return reply.code(400).send({ error: "pedido inválido" });
    await db.query("DELETE FROM curso_ficheiros WHERE id = $1 AND regime = $2 AND curso_id = $3", [ficheiroId, regime, id]);
    return { ok: true };
  });

  app.get("/v1/cursos/:regime/:id/ficha", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id } = params(req);
    if (!regime || id == null) return reply.code(400).send({ error: "pedido inválido" });
    const row = await db.query<{ payload: unknown; criterios: unknown }>(
      "SELECT payload, criterios FROM curso_fichas WHERE regime = $1 AND curso_id = $2",
      [regime, id],
    );
    const found = row.rows[0];
    return { ficha: found ? { payload: asObj(found.payload), criterios: asArr(found.criterios) } : null };
  });

  app.put("/v1/cursos/:regime/:id/ficha", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id } = params(req);
    const parsed = fichaSchema.safeParse(req.body);
    if (!regime || id == null || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    await db.query(
      `INSERT INTO curso_fichas (regime, curso_id, payload, criterios)
       VALUES ($1, $2, COALESCE($3::jsonb, '{}'::jsonb), COALESCE($4::jsonb, '[]'::jsonb))
       ON CONFLICT (regime, curso_id) DO UPDATE SET
         payload = COALESCE($3::jsonb, curso_fichas.payload),
         criterios = COALESCE($4::jsonb, curso_fichas.criterios),
         updated_at = now()`,
      [
        regime,
        id,
        parsed.data.payload ?? null,
        parsed.data.criterios ?? null,
      ],
    );
    await audit(db, req.actor!.id, "curso.ficha", "curso", String(id), req.ip, { regime });
    return { ok: true };
  });

  app.get("/v1/cursos/:regime/fichas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime } = params(req);
    if (!regime) return reply.code(400).send({ error: "pedido inválido" });
    const rows = await db.query<{ curso_id: number; payload: unknown; criterios: unknown }>(
      "SELECT curso_id, payload, criterios FROM curso_fichas WHERE regime = $1",
      [regime],
    );
    return {
      fichas: rows.rows.map(r => ({ cursoId: Number(r.curso_id), payload: asObj(r.payload), criterios: asArr(r.criterios) })),
    };
  });

  app.get("/v1/formandos/:regime/:id/dossier", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id } = params(req);
    if (!regime || id == null) return reply.code(400).send({ error: "pedido inválido" });
    const [docs, notas] = await Promise.all([
      db.query<{ doc_id: string; ok: boolean; file_name: string; data: string; drive_file_id?: string; drive_url?: string }>(
        "SELECT doc_id, ok, file_name, data, drive_file_id, drive_url FROM formando_docs WHERE regime = $1 AND formando_id = $2",
        [regime, id],
      ),
      db.query<{ id: number; autor: string; texto: string; created_at: string | Date }>(
        "SELECT id, autor, texto, created_at FROM formando_notas WHERE regime = $1 AND formando_id = $2 ORDER BY created_at DESC LIMIT 60",
        [regime, id],
      ),
    ]);
    return {
      docs: docs.rows.map(r => ({
        id: r.doc_id, ok: r.ok, fileName: r.file_name, data: r.data,
        driveFileId: r.drive_file_id ?? "", driveUrl: r.drive_url ?? "",
      })),
      notas: notas.rows.map(r => ({
        id: Number(r.id),
        autor: r.autor,
        texto: r.texto,
        data: (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)).slice(0, 16).replace("T", " "),
      })),
    };
  });

  app.put("/v1/formandos/:regime/:id/docs", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id } = params(req);
    const parsed = formandoDocsSchema.safeParse(req.body);
    if (!regime || id == null || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    for (const doc of parsed.data.docs) {
      await db.query(
        `INSERT INTO formando_docs (regime, formando_id, doc_id, ok, file_name, data, drive_file_id, drive_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (regime, formando_id, doc_id) DO UPDATE SET
           ok = EXCLUDED.ok, file_name = EXCLUDED.file_name, data = EXCLUDED.data,
           drive_file_id = EXCLUDED.drive_file_id, drive_url = EXCLUDED.drive_url, updated_at = now()`,
        [regime, id, doc.id, doc.ok, doc.fileName, doc.data, doc.driveFileId ?? "", doc.driveUrl ?? ""],
      );
    }
    await audit(db, req.actor!.id, "formando.docs", "formando", String(id), req.ip, { regime });
    return { ok: true };
  });

  app.post("/v1/formandos/:regime/:id/notas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id } = params(req);
    const parsed = notaSchema.safeParse(req.body);
    if (!regime || id == null || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const row = await db.query<{ id: number; created_at: string | Date }>(
      `INSERT INTO formando_notas (regime, formando_id, autor, actor_id, texto)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [regime, id, req.actor!.name, req.actor!.id, parsed.data.texto],
    );
    const saved = row.rows[0];
    await audit(db, req.actor!.id, "formando.nota", "formando", String(id), req.ip, { regime });
    return {
      nota: {
        id: Number(saved?.id ?? 0),
        autor: req.actor!.name,
        texto: parsed.data.texto,
        data: (saved?.created_at instanceof Date ? saved.created_at.toISOString() : String(saved?.created_at ?? new Date().toISOString()))
          .slice(0, 16).replace("T", " "),
      },
    };
  });

  app.get("/v1/formadores/:id/docs", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: "pedido inválido" });
    const rows = await db.query<{ doc_id: string; uploaded: boolean; file_name: string; drive_file_id?: string; drive_url?: string }>(
      "SELECT doc_id, uploaded, file_name, drive_file_id, drive_url FROM formador_docs WHERE formador_id = $1",
      [id],
    );
    return { docs: rows.rows.map(r => ({
      id: r.doc_id, uploaded: r.uploaded, fileName: r.file_name,
      driveFileId: r.drive_file_id ?? "", driveUrl: r.drive_url ?? "",
    })) };
  });

  app.put("/v1/formadores/:id/docs", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = formadorDocsSchema.safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    for (const doc of parsed.data.docs) {
      await db.query(
        `INSERT INTO formador_docs (formador_id, doc_id, uploaded, file_name, drive_file_id, drive_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (formador_id, doc_id) DO UPDATE SET
           uploaded = EXCLUDED.uploaded, file_name = EXCLUDED.file_name,
           drive_file_id = EXCLUDED.drive_file_id, drive_url = EXCLUDED.drive_url, updated_at = now()`,
        [id, doc.id, doc.uploaded, doc.fileName, doc.driveFileId ?? "", doc.driveUrl ?? ""],
      );
    }
    await audit(db, req.actor!.id, "formador.docs", "formador", String(id), req.ip);
    return { ok: true };
  });

  app.get("/v1/inqueritos/:id/respostas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: "pedido inválido" });
    const rows = await db.query<{ id: number; turma: string; formando: string; respostas: unknown; created_at: string | Date }>(
      "SELECT id, turma, formando, respostas, created_at FROM inquerito_respostas WHERE inquerito_id = $1 ORDER BY created_at DESC LIMIT 200",
      [id],
    );
    const cat = await db.query<{ payload: unknown }>(
      "SELECT payload FROM catalog_items WHERE id = $1 AND kind = 'inqueritos'",
      [id],
    );
    const respostas = rows.rows.map(r => ({
      id: Number(r.id),
      turma: r.turma,
      formando: r.formando,
      respostas: asObj(r.respostas),
      data: (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)).slice(0, 16).replace("T", " "),
    }));
    return {
      respostas,
      metricas: metricasInquerito(perguntasDe(asObj(cat.rows[0]?.payload)), respostas.map(r => r.respostas)),
    };
  });

  app.post("/v1/inqueritos/:id/respostas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = respostaSchema.safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    await db.query(
      "INSERT INTO inquerito_respostas (inquerito_id, turma, formando, respostas) VALUES ($1, $2, $3, $4::jsonb)",
      [id, parsed.data.turma, parsed.data.formando, parsed.data.respostas],
    );
    await audit(db, req.actor!.id, "inquerito.resposta", "inquerito", String(id), req.ip);
    return { ok: true };
  });

  function perguntasDe(payload: Record<string, unknown>) {
    return asArr(payload.perguntas).map(raw => {
      const p = asObj(raw);
      return {
        id: Number(p.id) || 0,
        tipo: String(p.tipo ?? "texto"),
        texto: String(p.texto ?? ""),
        opcoes: asArr(p.opcoes).map(String),
      };
    }).filter(p => p.id);
  }

  function metricasInquerito(
    perguntas: { id: number; tipo: string; opcoes: string[] }[],
    respostas: Record<string, unknown>[],
  ) {
    return perguntas.map(p => {
      const vals = respostas.map(r => r[String(p.id)]).filter(v => v != null && v !== "");
      if (p.tipo === "escala") {
        const nums = vals.map(Number).filter(n => Number.isFinite(n));
        const media = nums.length ? Math.round((nums.reduce((s, n) => s + n, 0) / nums.length) * 10) / 10 : null;
        return { id: p.id, tipo: p.tipo, n: nums.length, media };
      }
      if (p.tipo === "simnao") {
        const sim = vals.filter(v => /^sim$/i.test(String(v))).length;
        const nao = vals.filter(v => /^n[aã]o$/i.test(String(v))).length;
        return { id: p.id, tipo: p.tipo, n: sim + nao, pctSim: sim + nao ? Math.round((sim / (sim + nao)) * 100) : null };
      }
      if (p.tipo === "multipla") {
        const contagens: Record<string, number> = {};
        for (const v of vals) contagens[String(v)] = (contagens[String(v)] ?? 0) + 1;
        return { id: p.id, tipo: p.tipo, n: vals.length, contagens };
      }
      return { id: p.id, tipo: p.tipo, n: vals.length };
    });
  }

  app.get("/v1/inqueritos/:id/publico", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: "pedido inválido" });
    let row = await db.query<{ public_token: string | null }>(
      "SELECT public_token FROM catalog_items WHERE id = $1 AND kind = 'inqueritos'",
      [id],
    );
    if (!row.rows[0]) return reply.code(404).send({ error: "inquérito inexistente" });
    let token = row.rows[0].public_token;
    if (!token) {
      token = randomBytes(18).toString("base64url");
      await db.query("UPDATE catalog_items SET public_token = $2, updated_at = now() WHERE id = $1", [id, token]);
    }
    return { token, url: `${config.appOrigin}/inquerito/${token}` };
  });

  app.get("/v1/public/inqueritos/:token", {
    config: { rateLimit: { max: 40, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const token = String((req.params as { token: string }).token ?? "");
    if (token.length < 8) return reply.code(400).send({ error: "ligação inválida" });
    const row = await db.query<{ id: number; payload: unknown }>(
      "SELECT id, payload FROM catalog_items WHERE public_token = $1 AND kind = 'inqueritos'",
      [token],
    );
    const found = row.rows[0];
    if (!found) return reply.code(404).send({ error: "inquérito inexistente ou ligação revogada" });
    const payload = asObj(found.payload);
    return {
      id: Number(found.id),
      titulo: String(payload.titulo ?? "Inquérito de satisfação"),
      perguntas: perguntasDe(payload),
    };
  });

  app.post("/v1/public/inqueritos/:token/respostas", {
    config: { rateLimit: { max: 8, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const token = String((req.params as { token: string }).token ?? "");
    const parsed = respostaSchema.safeParse(req.body);
    if (token.length < 8 || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const row = await db.query<{ id: number }>(
      "SELECT id FROM catalog_items WHERE public_token = $1 AND kind = 'inqueritos'",
      [token],
    );
    const found = row.rows[0];
    if (!found) return reply.code(404).send({ error: "inquérito inexistente" });
    await db.query(
      "INSERT INTO inquerito_respostas (inquerito_id, turma, formando, respostas) VALUES ($1, $2, $3, $4::jsonb)",
      [found.id, parsed.data.turma, parsed.data.formando, parsed.data.respostas],
    );
    return { ok: true };
  });

  app.get("/v1/dtp/:regime/:id/export", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime, id } = params(req);
    if (!regime || id == null) return reply.code(400).send({ error: "pedido inválido" });
    const turma = await loadTurma(db, regime, id);
    if (!turma) return reply.code(404).send({ error: "turma não encontrada" });
    const dtp = await dtpForTurma(db, regime, turma);
    const root = pastaSegura(dtpPastaNome(regime, turma.nome));
    const used = new Set<string>();
    const files: { name: string; data: Buffer }[] = [];
    const add = (rel: string, data: Buffer) => {
      files.push({ name: uniqueZipPath(used, rel), data });
    };

    const formandos = await formandosDaTurma(db, regime, turma);
    for (const cat of DTP_CATEGORIAS) {
      const itens = dtp.items.filter(i => dtpCategoriaDe(i) === cat.id);
      const extra: string[] = [];
      if (cat.id === "formandos") extra.push("", "Formandos da turma:", ...(formandos.length ? formandos.map(f => `  ${f.nome}`) : ["  Ainda sem formandos."]));
      if (cat.id === "formador") extra.push("", `Formador: ${turma.formador?.trim() || "por atribuir nesta turma."}`);
      const linhas = [
        `${cat.pasta} · ${turma.nome}`,
        `${turma.curso}`,
        "",
        ...itens.map(i => {
          const marca = i.estado === "ok" ? "[x]" : i.estado === "parcial" ? "[~]" : "[ ]";
          return `${marca} ${i.label}${i.anexo?.fileName ? ` · ${i.anexo.fileName}` : ""}`;
        }),
        ...extra,
      ];
      add(`${root}/${cat.pasta}/_indice.txt`, Buffer.from(linhas.join("\n"), "utf8"));
    }

    const seen = new Set<string>();
    const pushDrive = async (
      fileId: string,
      rel: string,
    ) => {
      if (!fileId || seen.has(fileId)) return;
      const content = await readDriveContent(db, fileId).catch(() => null);
      if (!content?.bytes) return;
      seen.add(fileId);
      add(rel, content.bytes);
    };

    for (const item of dtp.items) {
      if (!item.anexo?.driveFileId) continue;
      const rel = dtpZipRelPath({
        root,
        ambito: item.ambito,
        itemId: item.id,
        itemLabel: item.label,
        fileName: nomeArquivoDtp(item.label, item.anexo.fileName || "anexo.pdf"),
      });
      await pushDrive(item.anexo.driveFileId, rel);
    }

    const drive = [
      ...await listDriveFiles(db, { kind: "", regime, turma: turma.nome, limit: 200 }),
      ...await listDriveFiles(db, { kind: "", regime, turma: String(id), limit: 200 }),
    ];
    for (const f of drive) {
      if (seen.has(f.id)) continue;
      const item = dtp.items.find(i => i.label === f.label || i.id === f.label);
      const rel = dtpZipRelPath({
        root,
        ambito: item?.ambito ?? (f.kind === "formando-doc" || f.kind === "pip" ? "formando" : f.kind === "formador-doc" ? "formador" : "turma"),
        itemId: item?.id,
        itemLabel: item?.label || f.label || undefined,
        pessoa: f.formando ?? undefined,
        kind: f.kind,
        fileName: nomeArquivoDtp(item?.label || f.label || undefined, f.name),
      });
      await pushDrive(f.id, rel);
    }

    const ids = formandos.map(f => f.id);
    if (ids.length) {
      const docs = await db.query<{ doc_id: string; file_name: string; drive_file_id: string; formando_id: number }>(
        `SELECT formando_id, doc_id, file_name, drive_file_id FROM formando_docs
          WHERE regime = $1 AND formando_id = ANY($2::int[]) AND drive_file_id <> ''`,
        [regime, pgIntArray(ids)],
      ).catch(() => ({ rows: [] as { doc_id: string; file_name: string; drive_file_id: string; formando_id: number }[] }));
      for (const row of docs.rows) {
        const pessoa = formandos.find(f => f.id === row.formando_id)?.nome ?? String(row.formando_id);
        const rel = dtpZipRelPath({
          root,
          ambito: "formando",
          itemId: row.doc_id,
          itemLabel: row.doc_id,
          pessoa,
          kind: "formando-doc",
          fileName: nomeArquivoDtp(row.doc_id, row.file_name || "documento.pdf"),
        });
        await pushDrive(row.drive_file_id, rel);
      }
    }

    const formadorNome = (turma.formador ?? "").trim();
    if (formadorNome) {
      const fr = await db.query<{ id: number }>("SELECT id FROM formadores WHERE nome = $1 LIMIT 1", [formadorNome]);
      const fid = fr.rows[0]?.id;
      if (fid != null) {
        const fdocs = await db.query<{ doc_id: string; file_name: string; drive_file_id: string }>(
          "SELECT doc_id, file_name, drive_file_id FROM formador_docs WHERE formador_id = $1 AND drive_file_id <> ''",
          [fid],
        ).catch(() => ({ rows: [] as { doc_id: string; file_name: string; drive_file_id: string }[] }));
        for (const row of fdocs.rows) {
          const rel = dtpZipRelPath({
            root,
            ambito: "formador",
            itemId: row.doc_id,
            itemLabel: row.doc_id,
            kind: "formador-doc",
            fileName: nomeArquivoDtp(row.doc_id, row.file_name || "documento.pdf"),
          });
          await pushDrive(row.drive_file_id, rel);
        }
      }
    }

    const pdfs = files.filter(f => !f.name.endsWith("/_indice.txt") && !f.name.endsWith("/00-Indice geral.txt"));
    const indice = [
      `Dossiê técnico-pedagógico`,
      root,
      `Turma: ${turma.nome}`,
      `Curso: ${turma.curso}`,
      `Regime: ${regime === "fin" ? "Financiada" : "Gold"}`,
      `Completude: ${dtp.pct}% · ${dtp.ok} no dossiê · ${dtp.parcial} parciais · ${dtp.falta} em falta`,
      `Ficheiros: ${pdfs.length}`,
      "",
      "Organização da pasta (por categoria):",
      `  ${root}/`,
      ...DTP_CATEGORIAS.map(c => `    ${c.pasta}/`),
      "",
      "Documentos do dossiê:",
      ...dtp.items.map(i => {
        const pasta = dtpCategoriaPasta(i);
        const marca = i.estado === "ok" ? "ok" : i.estado === "parcial" ? "parcial" : "falta";
        return `  [${marca}] ${pasta} / ${i.label}`;
      }),
      "",
      "Ficheiros neste ZIP:",
      ...files.map(f => `  ${f.name}`),
      pdfs.length ? "" : "Ainda não há PDFs no Drive desta turma. As pastas e o índice ficam no ZIP para o arquivo.",
    ].join("\n");
    add(`${root}/00-Indice geral.txt`, Buffer.from(indice, "utf8"));

    const zip = zipStore(files);
    const zipName = dtpZipNome(regime, turma.nome);
    await audit(db, req.actor!.id, "dtp.export", "turma", String(id), req.ip, { ficheiros: pdfs.length, pasta: root });
    return reply
      .header("Content-Type", "application/zip")
      .header("Content-Disposition", `attachment; filename="${zipName}"`)
      .send(zip);
  });
}
