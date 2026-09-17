import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Db } from "./db/pool.js";
import { buildDtpItems, dtpPct, type DtpCounts, type DtpEstado, type DtpFacts } from "./dtpModel.js";

type Regime = "gold" | "fin";

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
  })).max(40),
});

const notaSchema = z.object({ texto: z.string().trim().min(1).max(2000) });

const formadorDocsSchema = z.object({
  docs: z.array(z.object({
    id: z.string().min(1).max(60),
    uploaded: z.boolean(),
    fileName: z.string().max(240).default(""),
  })).max(40),
});

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

type TurmaRow = { id: number; nome: string; curso: string; cronograma: unknown };

async function loadTurma(db: Db, regime: Regime, id: number): Promise<TurmaRow | null> {
  const table = regime === "gold" ? "turmas_gold" : "turmas_fin";
  const row = await db.query<TurmaRow>(`SELECT id, nome, curso, cronograma FROM ${table} WHERE id = $1`, [id]);
  return row.rows[0] ?? null;
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
    if (regime === "fin") {
      for (const key of ["cc", "ch", "cu", "ci", "ce"]) {
        const done = formandos.filter(f => Boolean(asObj(f.docs[key]).ok)).length;
        docs[key] = { done, total };
      }
    } else {
      const ids = formandos.map(f => f.id);
      const rows = ids.length
        ? await db.query<{ doc_id: string; n: number }>(
          `SELECT doc_id, count(*)::int AS n FROM formando_docs
             WHERE regime = 'gold' AND ok = true AND formando_id = ANY($1::int[])
             GROUP BY doc_id`,
          [ids],
        )
        : { rows: [] as { doc_id: string; n: number }[] };
      for (const r of rows.rows) docs[r.doc_id] = { done: Number(r.n) || 0, total };
      for (const key of ["cc", "contrato", "pip", "exp", "regulamento"]) {
        docs[key] ??= { done: 0, total };
      }
    }
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

async function dtpForTurma(db: Db, regime: Regime, turma: TurmaRow) {
  const [facts, manual] = await Promise.all([turmaFacts(db, regime, turma), manualDtp(db, regime, turma.id)]);
  const items = buildDtpItems(regime, facts, manual);
  return {
    items,
    pct: dtpPct(items),
    ok: items.filter(i => i.estado === "ok").length,
    parcial: items.filter(i => i.estado === "parcial").length,
    falta: items.filter(i => i.estado === "falta").length,
    total: items.length,
    facts,
  };
}

export async function dtpResumo(db: Db, regime: Regime) {
  const table = regime === "gold" ? "turmas_gold" : "turmas_fin";
  const rows = await db.query<TurmaRow>(`SELECT id, nome, curso, cronograma FROM ${table}`);
  const out: Record<number, number> = {};
  for (const turma of rows.rows) {
    const dtp = await dtpForTurma(db, regime, turma);
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
        patch.plano ? JSON.stringify(patch.plano) : null,
        patch.sumario ? JSON.stringify(patch.sumario) : null,
        patch.presencas ? JSON.stringify(patch.presencas) : null,
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
      [regime, id, doc.grupoId, doc.label, doc.estado, doc.detalhe, doc.payload === undefined ? null : JSON.stringify(doc.payload)],
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

  app.get("/v1/dtp/:regime", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const { regime } = params(req);
    if (!regime) return reply.code(400).send({ error: "pedido inválido" });
    return { pct: await dtpResumo(db, regime) };
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
        parsed.data.payload ? JSON.stringify(parsed.data.payload) : null,
        parsed.data.criterios ? JSON.stringify(parsed.data.criterios) : null,
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
      db.query<{ doc_id: string; ok: boolean; file_name: string; data: string }>(
        "SELECT doc_id, ok, file_name, data FROM formando_docs WHERE regime = $1 AND formando_id = $2",
        [regime, id],
      ),
      db.query<{ id: number; autor: string; texto: string; created_at: string | Date }>(
        "SELECT id, autor, texto, created_at FROM formando_notas WHERE regime = $1 AND formando_id = $2 ORDER BY created_at DESC LIMIT 60",
        [regime, id],
      ),
    ]);
    return {
      docs: docs.rows.map(r => ({ id: r.doc_id, ok: r.ok, fileName: r.file_name, data: r.data })),
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
        `INSERT INTO formando_docs (regime, formando_id, doc_id, ok, file_name, data)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (regime, formando_id, doc_id) DO UPDATE SET
           ok = EXCLUDED.ok, file_name = EXCLUDED.file_name, data = EXCLUDED.data, updated_at = now()`,
        [regime, id, doc.id, doc.ok, doc.fileName, doc.data],
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
    const rows = await db.query<{ doc_id: string; uploaded: boolean; file_name: string }>(
      "SELECT doc_id, uploaded, file_name FROM formador_docs WHERE formador_id = $1",
      [id],
    );
    return { docs: rows.rows.map(r => ({ id: r.doc_id, uploaded: r.uploaded, fileName: r.file_name })) };
  });

  app.put("/v1/formadores/:id/docs", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = formadorDocsSchema.safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    for (const doc of parsed.data.docs) {
      await db.query(
        `INSERT INTO formador_docs (formador_id, doc_id, uploaded, file_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (formador_id, doc_id) DO UPDATE SET
           uploaded = EXCLUDED.uploaded, file_name = EXCLUDED.file_name, updated_at = now()`,
        [id, doc.id, doc.uploaded, doc.fileName],
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
    return {
      respostas: rows.rows.map(r => ({
        id: Number(r.id),
        turma: r.turma,
        formando: r.formando,
        respostas: asObj(r.respostas),
        data: (r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at)).slice(0, 16).replace("T", " "),
      })),
    };
  });

  app.post("/v1/inqueritos/:id/respostas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = respostaSchema.safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    await db.query(
      "INSERT INTO inquerito_respostas (inquerito_id, turma, formando, respostas) VALUES ($1, $2, $3, $4::jsonb)",
      [id, parsed.data.turma, parsed.data.formando, JSON.stringify(parsed.data.respostas)],
    );
    await audit(db, req.actor!.id, "inquerito.resposta", "inquerito", String(id), req.ip);
    return { ok: true };
  });
}
