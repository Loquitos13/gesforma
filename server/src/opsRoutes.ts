import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { ingestEvent } from "./automations.js";
import type { Db } from "./db/pool.js";
import { isEmail, normalizeEmail, sanitizeHeader } from "./security.js";
import {
  confirmarPagamento,
  findPagamentoPorReferencia,
  getOpsSnapshot,
  mapBlog,
  mapCampanha,
  mapCursoFin,
  mapCursoGold,
  mapFormandoFin,
  mapFormandoGold,
  mapFormador,
  mapPagamento,
  mapPreinscricao,
  mapTurmaFin,
  mapTurmaGold,
  nextOpsId,
} from "./ops.js";
import { exportCrmLeads, queryCrmLeads, searchCrmLeads, type CrmFila, type CrmSort } from "./crm.js";
import {
  addLeadNota, createCrmCampo, createCrmEtiqueta, deleteCrmEtiqueta, getLeadDossier,
  listCrmCampos, listCrmEtiquetas, logLeadEvent, setCampoValores, type CrmCampoTipo,
} from "./crmDossier.js";
import { globalSearch } from "./globalSearch.js";
import { config } from "./config.js";

const preSchema = z.object({
  nome: z.string().trim().min(1).max(80),
  apelido: z.string().trim().max(80).optional().default(""),
  email: z.string().trim().min(3).max(254),
  telf: z.string().trim().max(30).optional().default(""),
  concelho: z.string().trim().max(80).optional().default(""),
  origem: z.string().trim().max(80).optional().default("Website"),
  entrada: z.enum(["preinscricao", "manual"]).optional(),
  nota: z.string().max(2000).optional(),
  curso: z.string().trim().max(200).optional().default(""),
  local: z.string().trim().max(120).optional().default(""),
  inicioCurso: z.string().trim().max(40).optional().default("-"),
  preco: z.number().min(0).max(20000).optional().default(0),
  campanha: z.string().trim().max(80).optional().default(""),
  estado: z.string().trim().max(40).optional(),
  proximoContacto: z.string().trim().max(40).optional(),
  notas: z.string().max(4000).optional(),
  comercialId: z.string().uuid().optional().nullable(),
  meioContacto: z.string().trim().max(40).optional(),
  etiquetaId: z.number().int().positive().nullable().optional(),
});

function nowStamp() {
  return new Date().toISOString().slice(0, 16).replace("T", " ");
}

async function one(db: Db, sql: string, params: unknown[]) {
  const rows = await db.query(sql, params);
  return rows.rows[0] ?? null;
}

export function registerOpsRoutes(
  app: FastifyInstance,
  db: Db,
  helpers: {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => boolean;
    audit: (db: Db, actorId: string | undefined, action: string, entity: string, entityId?: string, ip?: string, meta?: Record<string, unknown>) => Promise<void>;
  },
) {
  const { requireAuth, audit } = helpers;

  app.get("/v1/ops", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return getOpsSnapshot(db);
  });

  const crmFila = z.enum(["contactar", "atrasados", "hoje", "converter", "abertos"]).optional();
  const crmSort = z.enum(["inscrito", "proximo", "valor", "nome"]).optional();

  function crmParamsFromQuery(q: Record<string, unknown>) {
    const str = (k: string) => String(q[k] ?? "").trim();
    const fila = crmFila.safeParse(str("fila") || undefined);
    const sort = crmSort.safeParse(str("sort") || "inscrito");
    return {
      q: str("q").slice(0, 80),
      estado: str("estado"),
      curso: str("curso"),
      local: str("local"),
      origem: str("origem"),
      entrada: (str("entrada") === "manual" ? "manual" : str("entrada") === "preinscricao" ? "preinscricao" : "") as "" | "preinscricao" | "manual",
      campanha: str("campanha"),
      fila: (fila.success ? fila.data : "") as CrmFila | "",
      page: Number(q.page) || 1,
      perPage: Number(q.perPage) || 50,
      sort: (sort.success ? sort.data : "inscrito") as CrmSort,
      kanban: str("kanban") === "1" || str("kanban") === "true",
    };
  }

  function hojeDe(q: Record<string, unknown>) {
    const h = String(q.hoje ?? "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(h) ? h : new Date().toISOString().slice(0, 10);
  }

  app.get("/v1/crm/leads", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const q = (req.query ?? {}) as Record<string, unknown>;
    return queryCrmLeads(db, crmParamsFromQuery(q), hojeDe(q));
  });

  app.get("/v1/crm/search", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const q = String((req.query as { q?: string } | undefined)?.q ?? "").trim();
    if (q.length < 2) return { leads: [] };
    return { leads: await searchCrmLeads(db, q, 12) };
  });

  app.get("/v1/search", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const q = String((req.query as { q?: string } | undefined)?.q ?? "").trim();
    if (q.length < 1) return { q: "", kind: "nome", kindLabel: "nome", groups: [], total: 0 };
    return globalSearch(db, q);
  });

  app.get("/v1/crm/export", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const q = (req.query ?? {}) as Record<string, unknown>;
    const rows = await exportCrmLeads(db, crmParamsFromQuery(q), hojeDe(q));
    const head = ["id", "inscrito", "nome", "apelido", "email", "telf", "curso", "local", "preco", "estado", "origem", "entrada", "meioContacto", "etiquetaNome", "campanha", "proximoContacto"];
    const esc = (v: unknown) => {
      const s = String(v ?? "");
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = [head.join(";"), ...rows.map(r => head.map(k => esc((r as Record<string, unknown>)[k])).join(";"))].join("\n");
    reply.header("Content-Type", "text/csv; charset=utf-8");
    reply.header("Content-Disposition", "attachment; filename=crm-leads.csv");
    return reply.send("\uFEFF" + body);
  });

  const loteSchema = z.object({
    ids: z.array(z.number().int().positive()).min(1).max(100),
    acao: z.enum(["contactar", "estado", "seguimento"]),
    estado: z.string().trim().max(40).optional(),
    proximoContacto: z.string().trim().max(40).optional(),
    nota: z.string().max(800).optional(),
  });

  app.post("/v1/crm/lote", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = loteSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    let updated = 0;
    for (const id of d.ids) {
      const current = await one(db, "SELECT * FROM preinscricoes WHERE id = $1", [id]);
      if (!current) continue;
      if (d.acao === "contactar") {
        const estado = String(current.estado);
        const nextEstado = estado === "Não contactado" ? "1º Contacto" : estado;
        const nota = (d.nota ?? "").trim();
        await db.query(
          `UPDATE preinscricoes SET estado = $2, contactado_em = now(), notas = CASE WHEN $3 = '' THEN notas ELSE trim(both from notas || E'\n' || $3) END WHERE id = $1`,
          [id, nextEstado, nota],
        );
        await db.query(
          "INSERT INTO preinscricao_contactos (preinscricao_id, actor_id, nota) VALUES ($1,$2,$3)",
          [id, req.actor!.id, nota],
        );
        await logLeadEvent(db, id, req.actor!.id, "contacto", "Contacto em lote", nota || `Passou a ${nextEstado}`);
        updated += 1;
      } else if (d.acao === "estado" && d.estado) {
        await db.query("UPDATE preinscricoes SET estado = $2 WHERE id = $1 AND estado <> 'Formando'", [id, d.estado]);
        await logLeadEvent(db, id, req.actor!.id, "estado", `Passou a ${d.estado}`, `De ${String(current.estado)}`);
        if (d.estado === "Pago") {
          const email = normalizeEmail(String(current.email ?? ""));
          if (isEmail(email)) {
            await ingestEvent(db, "payment.confirmed", {
              email,
              nome: `${current.nome} ${current.apelido}`.trim(),
              curso: String(current.curso ?? ""),
              preinscricaoId: id,
            }, `payment:pre:${id}:${email}`).catch(() => undefined);
          }
        }
        updated += 1;
      } else if (d.acao === "seguimento") {
        await db.query(
          "UPDATE preinscricoes SET proximo_contacto = COALESCE($2, proximo_contacto), notas = CASE WHEN $3 = '' THEN notas ELSE trim(both from notas || E'\n' || $3) END WHERE id = $1",
          [id, d.proximoContacto ?? null, (d.nota ?? "").trim()],
        );
        await logLeadEvent(db, id, req.actor!.id, "seguimento", "Seguimento em lote", d.proximoContacto ? `Próximo contacto ${d.proximoContacto}` : (d.nota ?? ""));
        updated += 1;
      }
    }
    await audit(db, req.actor!.id, "crm.lote", "preinscricao", String(d.ids.length), req.ip, { acao: d.acao, n: updated });
    return { updated };
  });

  app.get("/v1/crm/campos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return { campos: await listCrmCampos(db) };
  });

  const campoSchema = z.object({
    label: z.string().trim().min(1).max(80),
    tipo: z.enum(["texto", "numero", "data", "lista"]).optional().default("texto"),
    opcoes: z.array(z.string().trim().min(1).max(80)).max(30).optional().default([]),
  });

  app.post("/v1/crm/campos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = campoSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const campo = await createCrmCampo(db, d.label, d.tipo as CrmCampoTipo, d.opcoes);
    await audit(db, req.actor!.id, "crm.campo.create", "crm_campo", String(campo.id), req.ip);
    return { campo };
  });

  app.get("/v1/crm/etiquetas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    return { etiquetas: await listCrmEtiquetas(db) };
  });

  app.post("/v1/crm/etiquetas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = z.object({
      nome: z.string().trim().min(1).max(40),
      cor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/),
    }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const etiqueta = await createCrmEtiqueta(db, parsed.data.nome, parsed.data.cor);
    await audit(db, req.actor!.id, "crm.etiqueta.create", "crm_etiqueta", String(etiqueta.id), req.ip);
    return { etiqueta };
  });

  app.delete("/v1/crm/etiquetas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return reply.code(400).send({ error: "pedido inválido" });
    await deleteCrmEtiqueta(db, id);
    return { ok: true };
  });

  app.get("/v1/crm/leads/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id) || id <= 0) return reply.code(400).send({ error: "pedido inválido" });
    const dossier = await getLeadDossier(db, id);
    if (!dossier) return reply.code(404).send({ error: "lead inexistente" });
    return dossier;
  });

  app.post("/v1/crm/leads/:id/campos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = z.object({
      valores: z.array(z.object({
        campoId: z.number().int().positive(),
        valor: z.string().max(2000),
      })).min(1).max(40),
    }).safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const exists = await one(db, "SELECT id FROM preinscricoes WHERE id = $1", [id]);
    if (!exists) return reply.code(404).send({ error: "lead inexistente" });
    await setCampoValores(db, id, req.actor!.id, parsed.data.valores);
    return getLeadDossier(db, id);
  });

  app.post("/v1/crm/leads/:id/notas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = z.object({ nota: z.string().trim().min(1).max(2000), meio: z.string().trim().max(40).optional() }).safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const exists = await one(db, "SELECT id FROM preinscricoes WHERE id = $1", [id]);
    if (!exists) return reply.code(404).send({ error: "lead inexistente" });
    await addLeadNota(db, id, req.actor!.id, parsed.data.nota, parsed.data.meio ?? "");
    await audit(db, req.actor!.id, "crm.nota", "preinscricao", String(id), req.ip);
    return getLeadDossier(db, id);
  });

  app.get("/v1/public/cursos", async () => {
    const rows = await db.query<{ nome: string; preco: number }>(
      "SELECT nome, preco FROM cursos_gold WHERE estado = 'Ativo' ORDER BY nome",
    );
    return { cursos: rows.rows.map(r => ({ nome: r.nome, preco: Number(r.preco) })) };
  });

  app.post("/v1/public/preinscricoes", {
    config: { rateLimit: { max: 8, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    const parsed = preSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const email = normalizeEmail(d.email);
    if (!isEmail(email)) return reply.code(400).send({ error: "email inválido" });
    const curso = sanitizeHeader(d.curso || "Formação de Formadores - CCP");
    const precoRow = await one(db, "SELECT preco FROM cursos_gold WHERE nome = $1", [curso]);
    const id = await nextOpsId(db);
    await db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, inicio_curso, concelho, local, curso, preco, estado, campanha, origem, entrada)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'Não contactado',$12,$13,'preinscricao')`,
      [
        id, nowStamp(), sanitizeHeader(d.nome), sanitizeHeader(d.apelido), email,
        sanitizeHeader(d.telf), d.inicioCurso || "-", sanitizeHeader(d.concelho),
        sanitizeHeader(d.local), curso, Number(precoRow?.preco ?? d.preco ?? 0),
        sanitizeHeader(d.campanha || ""), sanitizeHeader(d.origem || "Website"),
      ],
    );
    const nome = `${d.nome} ${d.apelido}`.trim();
    await ingestEvent(db, "preinscricao.created", { email, nome, curso, preinscricaoId: id }, `preinscricao:${id}:${email}`).catch(() => undefined);
    await logLeadEvent(db, id, undefined, "criacao", "Pré-inscrição recebida", `Formulário público · ${sanitizeHeader(d.origem || "Website")} · ${curso}`);
    await audit(db, undefined, "preinscricao.public_create", "preinscricao", String(id), req.ip, { curso });
    const row = await one(db, "SELECT * FROM preinscricoes WHERE id = $1", [id]);
    return { preinscricao: row ? mapPreinscricao(row) : { id }, aviso: "A secretaria contacta-o em breve." };
  });

  app.post("/v1/preinscricoes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = preSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const email = normalizeEmail(d.email);
    if (!isEmail(email)) return reply.code(400).send({ error: "email inválido" });
    const id = await nextOpsId(db);
    const comercialId = d.comercialId ?? (req.actor?.role === "comercial" ? req.actor.id : null);
    await db.query(
      `INSERT INTO preinscricoes (id, inscrito, nome, apelido, email, telf, inicio_curso, concelho, local, curso, preco, estado, campanha, origem, comercial_id, entrada, meio_contacto, etiqueta_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'manual',$16,$17)`,
      [
        id, nowStamp(), d.nome, d.apelido, email, d.telf, d.inicioCurso || "-",
        d.concelho, d.local, d.curso, d.preco ?? 0, d.estado || "Não contactado", d.campanha, d.origem || "Telefone", comercialId,
        d.meioContacto || d.origem || "Telefone", d.etiquetaId ?? null,
      ],
    );
    await ingestEvent(db, "preinscricao.created", { email, nome: `${d.nome} ${d.apelido}`.trim(), curso: d.curso, preinscricaoId: id }, `preinscricao:${id}:${email}`).catch(() => undefined);
    await logLeadEvent(db, id, req.actor!.id, "criacao", "Lead manual criada", `${d.origem || "Telefone"} · ${d.curso}`);
    const nota = (d.nota ?? "").trim();
    if (nota) await addLeadNota(db, id, req.actor!.id, nota, d.meioContacto || d.origem || "Telefone");
    await audit(db, req.actor!.id, "preinscricao.create", "preinscricao", String(id), req.ip, { entrada: "manual" });
    const row = await one(db, "SELECT * FROM preinscricoes WHERE id = $1", [id]);
    return { preinscricao: row ? mapPreinscricao(row) : { id } };
  });

  app.patch("/v1/preinscricoes/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = preSchema.partial().safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const before = await one(db, "SELECT * FROM preinscricoes WHERE id = $1", [id]);
    await db.query(
      `UPDATE preinscricoes SET
         nome = COALESCE($2, nome), apelido = COALESCE($3, apelido), email = COALESCE($4, email),
         telf = COALESCE($5, telf), concelho = COALESCE($6, concelho), origem = COALESCE($7, origem),
         curso = COALESCE($8, curso), local = COALESCE($9, local), inicio_curso = COALESCE($10, inicio_curso),
         preco = COALESCE($11, preco), campanha = COALESCE($12, campanha), estado = COALESCE($13, estado),
         proximo_contacto = COALESCE($14, proximo_contacto), notas = COALESCE($15, notas),
         comercial_id = COALESCE($16, comercial_id),
         meio_contacto = COALESCE($17, meio_contacto),
         etiqueta_id = CASE WHEN $18::int = -1 THEN etiqueta_id WHEN $18 = 0 THEN NULL ELSE $18 END
       WHERE id = $1`,
      [
        id, d.nome ?? null, d.apelido ?? null, d.email ? normalizeEmail(d.email) : null, d.telf ?? null, d.concelho ?? null, d.origem ?? null, d.curso ?? null, d.local ?? null, d.inicioCurso ?? null, d.preco ?? null, d.campanha ?? null, d.estado ?? null, d.proximoContacto ?? null, d.notas ?? null, d.comercialId ?? null,
        d.meioContacto ?? null,
        d.etiquetaId === undefined ? -1 : (d.etiquetaId ?? 0),
      ],
    );
    const row = await one(db, "SELECT * FROM preinscricoes WHERE id = $1", [id]);
    if (before && d.estado && d.estado !== String(before.estado)) {
      await logLeadEvent(db, id, req.actor!.id, "estado", `Passou a ${d.estado}`, `De ${String(before.estado)}`);
    }
    if (before && d.proximoContacto && d.proximoContacto !== String(before.proximo_contacto ?? "")) {
      await logLeadEvent(db, id, req.actor!.id, "seguimento", "Próximo contacto", d.proximoContacto);
    }
    if (row && d.estado === "Pago") {
      const email = normalizeEmail(String(row.email ?? ""));
      if (isEmail(email)) {
        await ingestEvent(db, "payment.confirmed", {
          email,
          nome: `${row.nome} ${row.apelido}`.trim(),
          curso: String(row.curso ?? ""),
          preinscricaoId: id,
        }, `payment:pre:${id}:${email}`).catch(() => undefined);
      }
    }
    return { preinscricao: row ? mapPreinscricao(row) : null };
  });

  app.post("/v1/preinscricoes/:id/contactar", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const nota = String((req.body as { nota?: string } | undefined)?.nota ?? "").trim().slice(0, 800);
    const meio = String((req.body as { meio?: string } | undefined)?.meio ?? "").trim().slice(0, 40);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: "pedido inválido" });
    const current = await one(db, "SELECT * FROM preinscricoes WHERE id = $1", [id]);
    if (!current) return reply.code(404).send({ error: "pré-inscrição inexistente" });
    const estado = String(current.estado);
    const nextEstado = estado === "Não contactado" ? "1º Contacto" : estado;
    await db.query(
      `UPDATE preinscricoes SET estado = $2, contactado_em = now(),
         notas = CASE WHEN $3 = '' THEN notas ELSE trim(both from notas || E'\n' || $3) END,
         meio_contacto = CASE WHEN $4 = '' THEN meio_contacto ELSE $4 END
       WHERE id = $1`,
      [id, nextEstado, nota, meio],
    );
    await db.query(
      "INSERT INTO preinscricao_contactos (preinscricao_id, actor_id, nota, meio) VALUES ($1,$2,$3,$4)",
      [id, req.actor!.id, nota, meio],
    );
    await logLeadEvent(db, id, req.actor!.id, "contacto", meio ? `Contacto · ${meio}` : (nextEstado === estado ? "Contacto registado" : "1.º contacto"), nota || `Passou a ${nextEstado}`);
    const email = normalizeEmail(String(current.email ?? ""));
    if (isEmail(email)) {
      await ingestEvent(db, "preinscricao.contacted", {
        email,
        nome: `${current.nome} ${current.apelido}`.trim(),
        curso: String(current.curso ?? ""),
        preinscricaoId: id,
      }, `contacted:${id}:${email}`).catch(() => undefined);
    }
    await audit(db, req.actor!.id, "preinscricao.contactar", "preinscricao", String(id), req.ip);
    const row = await one(db, "SELECT * FROM preinscricoes WHERE id = $1", [id]);
    return { preinscricao: row ? mapPreinscricao(row) : null };
  });

  app.delete("/v1/preinscricoes/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: "pedido inválido" });
    await db.query("DELETE FROM preinscricoes WHERE id = $1", [id]);
    return { ok: true };
  });

  const formandoGoldSchema = z.object({
    nome: z.string().trim().min(1).max(80),
    apelido: z.string().trim().max(80).optional().default(""),
    telf: z.string().max(30).optional().default(""),
    email: z.string().max(254).optional().default(""),
    inscrito: z.string().max(40).optional(),
    local: z.string().max(120).optional().default(""),
    curso: z.string().max(200).optional().default(""),
    turma: z.string().max(120).optional().default(""),
    turmaId: z.number().optional(),
    estado: z.string().max(40).optional().default("Formando"),
    pago: z.boolean().optional().default(false),
    valor: z.number().optional().default(0),
    metodo: z.string().max(40).optional().default("-"),
  });

  app.post("/v1/formandos-gold", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = formandoGoldSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const id = await nextOpsId(db);
    await db.query(
      `INSERT INTO formandos_gold (id, nome, apelido, telf, email, inscrito, local, curso, turma, turma_id, estado, pago, valor, metodo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [id, d.nome, d.apelido, d.telf, d.email, d.inscrito || nowStamp(), d.local, d.curso, d.turma, d.turmaId ?? null, d.estado, d.pago, d.valor, d.metodo],
    );
    const row = await one(db, "SELECT * FROM formandos_gold WHERE id = $1", [id]);
    return { formando: row ? mapFormandoGold(row) : { id } };
  });

  app.patch("/v1/formandos-gold/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = formandoGoldSchema.partial().safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    await db.query(
      `UPDATE formandos_gold SET
         nome = COALESCE($2, nome), apelido = COALESCE($3, apelido), telf = COALESCE($4, telf),
         email = COALESCE($5, email), local = COALESCE($6, local), curso = COALESCE($7, curso),
         turma = COALESCE($8, turma), turma_id = COALESCE($9, turma_id), estado = COALESCE($10, estado),
         pago = COALESCE($11, pago), valor = COALESCE($12, valor), metodo = COALESCE($13, metodo)
       WHERE id = $1`,
      [id, d.nome ?? null, d.apelido ?? null, d.telf ?? null, d.email ?? null, d.local ?? null, d.curso ?? null, d.turma ?? null, d.turmaId ?? null, d.estado ?? null, d.pago ?? null, d.valor ?? null, d.metodo ?? null],
    );
    const row = await one(db, "SELECT * FROM formandos_gold WHERE id = $1", [id]);
    const mapped = row ? mapFormandoGold(row) : null;
    if (mapped && d.estado && /conclu/i.test(d.estado) && mapped.email) {
      await ingestEvent(db, "formando.completed", {
        email: mapped.email,
        nome: `${mapped.nome} ${mapped.apelido}`.trim(),
        curso: mapped.curso,
        turma: mapped.turma,
      }, `formando.completed:${id}`).catch(() => undefined);
    }
    return { formando: mapped };
  });

  app.delete("/v1/formandos-gold/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await db.query("DELETE FROM formandos_gold WHERE id = $1", [id]);
    return { ok: true };
  });

  const formandoFinSchema = z.object({
    nome: z.string().trim().min(1).max(80),
    apelido: z.string().trim().max(80).optional().default(""),
    turma: z.string().max(120).optional().default(""),
    telf: z.string().max(30).optional().default(""),
    email: z.string().max(254).optional().default(""),
    curso: z.string().max(200).optional().default(""),
    estado: z.string().max(40).optional().default("Elegível"),
    cc: z.object({ ok: z.boolean(), data: z.string() }).optional(),
    ch: z.object({ ok: z.boolean(), data: z.string() }).optional(),
    cu: z.object({ ok: z.boolean(), data: z.string() }).optional(),
    ci: z.object({ ok: z.boolean(), data: z.string() }).optional(),
    ce: z.object({ ok: z.boolean(), data: z.string() }).optional(),
  });

  app.post("/v1/formandos-fin", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = formandoFinSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const id = await nextOpsId(db);
    const docs = { cc: d.cc ?? { ok: false, data: "" }, ch: d.ch ?? { ok: false, data: "" }, cu: d.cu ?? { ok: false, data: "" }, ci: d.ci ?? { ok: false, data: "" }, ce: d.ce ?? { ok: false, data: "" } };
    await db.query(
      "INSERT INTO formandos_fin (id, nome, apelido, turma, telf, email, curso, estado, docs) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)",
      [id, d.nome, d.apelido, d.turma, d.telf, d.email, d.curso, d.estado, docs],
    );
    const row = await one(db, "SELECT * FROM formandos_fin WHERE id = $1", [id]);
    return { formando: row ? mapFormandoFin(row) : { id } };
  });

  app.patch("/v1/formandos-fin/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = formandoFinSchema.partial().safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const current = await one(db, "SELECT * FROM formandos_fin WHERE id = $1", [id]);
    if (!current) return reply.code(404).send({ error: "inexistente" });
    const prev = mapFormandoFin(current);
    const docs = {
      cc: d.cc ?? prev.cc, ch: d.ch ?? prev.ch, cu: d.cu ?? prev.cu, ci: d.ci ?? prev.ci, ce: d.ce ?? prev.ce,
    };
    await db.query(
      `UPDATE formandos_fin SET nome = COALESCE($2, nome), apelido = COALESCE($3, apelido), turma = COALESCE($4, turma),
         telf = COALESCE($5, telf), email = COALESCE($6, email), curso = COALESCE($7, curso), estado = COALESCE($8, estado), docs = $9::jsonb
       WHERE id = $1`,
      [id, d.nome ?? null, d.apelido ?? null, d.turma ?? null, d.telf ?? null, d.email ?? null, d.curso ?? null, d.estado ?? null, docs],
    );
    const row = await one(db, "SELECT * FROM formandos_fin WHERE id = $1", [id]);
    return { formando: row ? mapFormandoFin(row) : null };
  });

  app.delete("/v1/formandos-fin/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    await db.query("DELETE FROM formandos_fin WHERE id = $1", [id]);
    return { ok: true };
  });

  const cursoGoldSchema = z.object({
    nome: z.string().trim().min(1).max(200),
    categoria: z.string().max(120).optional().default(""),
    tipo: z.string().max(40).optional().default("Gold"),
    preco: z.number().optional().default(0),
    regime: z.string().max(40).optional().default("b-learning"),
    horas: z.number().optional().default(0),
    estado: z.string().max(40).optional().default("Ativo"),
  });

  app.post("/v1/cursos-gold", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = cursoGoldSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const id = await nextOpsId(db);
    await db.query(
      "INSERT INTO cursos_gold (id, nome, categoria, tipo, preco, regime, horas, estado) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)",
      [id, d.nome, d.categoria, d.tipo, d.preco, d.regime, d.horas, d.estado],
    );
    const row = await one(db, "SELECT * FROM cursos_gold WHERE id = $1", [id]);
    return { curso: row ? mapCursoGold(row) : { id } };
  });
  app.patch("/v1/cursos-gold/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = cursoGoldSchema.partial().safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    await db.query(
      `UPDATE cursos_gold SET nome = COALESCE($2, nome), categoria = COALESCE($3, categoria), tipo = COALESCE($4, tipo),
         preco = COALESCE($5, preco), regime = COALESCE($6, regime), horas = COALESCE($7, horas), estado = COALESCE($8, estado) WHERE id = $1`,
      [id, d.nome ?? null, d.categoria ?? null, d.tipo ?? null, d.preco ?? null, d.regime ?? null, d.horas ?? null, d.estado ?? null],
    );
    const row = await one(db, "SELECT * FROM cursos_gold WHERE id = $1", [id]);
    return { curso: row ? mapCursoGold(row) : null };
  });
  app.delete("/v1/cursos-gold/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await db.query("DELETE FROM cursos_gold WHERE id = $1", [Number((req.params as { id: string }).id)]);
    return { ok: true };
  });

  const cursoFinSchema = z.object({
    ufcdCod: z.string().max(20).optional().default(""),
    ufcd: z.string().trim().min(1).max(200),
    nomeComercial: z.string().max(200).optional().default(""),
    regime: z.string().max(40).optional().default("e-learning"),
    horas: z.number().optional().default(25),
    estado: z.string().max(40).optional().default("Ativo"),
  });
  app.post("/v1/cursos-fin", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = cursoFinSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const id = await nextOpsId(db);
    await db.query(
      "INSERT INTO cursos_fin (id, ufcd_cod, ufcd, nome_comercial, regime, horas, estado) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [id, d.ufcdCod, d.ufcd, d.nomeComercial, d.regime, d.horas, d.estado],
    );
    const row = await one(db, "SELECT * FROM cursos_fin WHERE id = $1", [id]);
    return { curso: row ? mapCursoFin(row) : { id } };
  });
  app.patch("/v1/cursos-fin/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = cursoFinSchema.partial().safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    await db.query(
      `UPDATE cursos_fin SET ufcd_cod = COALESCE($2, ufcd_cod), ufcd = COALESCE($3, ufcd), nome_comercial = COALESCE($4, nome_comercial),
         regime = COALESCE($5, regime), horas = COALESCE($6, horas), estado = COALESCE($7, estado) WHERE id = $1`,
      [id, d.ufcdCod ?? null, d.ufcd ?? null, d.nomeComercial ?? null, d.regime ?? null, d.horas ?? null, d.estado ?? null],
    );
    const row = await one(db, "SELECT * FROM cursos_fin WHERE id = $1", [id]);
    return { curso: row ? mapCursoFin(row) : null };
  });
  app.delete("/v1/cursos-fin/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await db.query("DELETE FROM cursos_fin WHERE id = $1", [Number((req.params as { id: string }).id)]);
    return { ok: true };
  });

  const turmaGoldSchema = z.object({
    dataInicio: z.string().max(20),
    nome: z.string().trim().min(1).max(80),
    curso: z.string().max(200),
    local: z.string().max(120).optional().default(""),
    horario: z.string().max(80).optional().default(""),
    totalAlunos: z.number().optional().default(0),
    vagas: z.number().optional().default(16),
    estado: z.string().max(20).optional().default("Ativa"),
    formador: z.string().max(120).optional().default(""),
    horas: z.number().optional().default(90),
    cronograma: z.array(z.unknown()).optional(),
  });
  app.post("/v1/turmas-gold", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = turmaGoldSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const id = await nextOpsId(db);
    await db.query(
      `INSERT INTO turmas_gold (id, data_inicio, nome, curso, local, horario, total_alunos, vagas, estado, formador, horas, cronograma)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [id, d.dataInicio, d.nome, d.curso, d.local, d.horario, d.totalAlunos, d.vagas, d.estado, d.formador, d.horas, d.cronograma ?? []],
    );
    const row = await one(db, "SELECT * FROM turmas_gold WHERE id = $1", [id]);
    return { turma: row ? mapTurmaGold(row) : { id } };
  });
  app.patch("/v1/turmas-gold/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = turmaGoldSchema.partial().safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    await db.query(
      `UPDATE turmas_gold SET data_inicio = COALESCE($2, data_inicio), nome = COALESCE($3, nome), curso = COALESCE($4, curso),
         local = COALESCE($5, local), horario = COALESCE($6, horario), total_alunos = COALESCE($7, total_alunos),
         vagas = COALESCE($8, vagas), estado = COALESCE($9, estado), formador = COALESCE($10, formador),
         horas = COALESCE($11, horas), cronograma = COALESCE($12::jsonb, cronograma) WHERE id = $1`,
      [id, d.dataInicio ?? null, d.nome ?? null, d.curso ?? null, d.local ?? null, d.horario ?? null, d.totalAlunos ?? null, d.vagas ?? null, d.estado ?? null, d.formador ?? null, d.horas ?? null, d.cronograma ?? null],
    );
    const row = await one(db, "SELECT * FROM turmas_gold WHERE id = $1", [id]);
    return { turma: row ? mapTurmaGold(row) : null };
  });
  app.delete("/v1/turmas-gold/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await db.query("DELETE FROM turmas_gold WHERE id = $1", [Number((req.params as { id: string }).id)]);
    return { ok: true };
  });

  const turmaFinSchema = z.object({
    dataInicio: z.string().max(20),
    nome: z.string().trim().min(1).max(120),
    curso: z.string().max(200),
    ufcdCod: z.string().max(20).optional().default(""),
    local: z.string().max(120).optional().default(""),
    horario: z.string().max(80).optional().default(""),
    alunos: z.number().optional().default(0),
    alunosTotal: z.number().optional().default(20),
    estado: z.string().max(40).optional().default("A montar"),
    horas: z.number().optional().default(25),
    formador: z.string().max(120).optional().default(""),
    activa: z.boolean().optional().default(true),
    cronograma: z.array(z.unknown()).optional(),
  });
  app.post("/v1/turmas-fin", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = turmaFinSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const id = await nextOpsId(db);
    await db.query(
      `INSERT INTO turmas_fin (id, data_inicio, nome, curso, ufcd_cod, local, horario, alunos, alunos_total, estado, horas, formador, activa, cronograma)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
      [id, d.dataInicio, d.nome, d.curso, d.ufcdCod, d.local, d.horario, d.alunos, d.alunosTotal, d.estado, d.horas, d.formador, d.activa, d.cronograma ?? []],
    );
    const row = await one(db, "SELECT * FROM turmas_fin WHERE id = $1", [id]);
    return { turma: row ? mapTurmaFin(row) : { id } };
  });
  app.patch("/v1/turmas-fin/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = turmaFinSchema.partial().safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    await db.query(
      `UPDATE turmas_fin SET data_inicio = COALESCE($2, data_inicio), nome = COALESCE($3, nome), curso = COALESCE($4, curso),
         ufcd_cod = COALESCE($5, ufcd_cod), local = COALESCE($6, local), horario = COALESCE($7, horario),
         alunos = COALESCE($8, alunos), alunos_total = COALESCE($9, alunos_total), estado = COALESCE($10, estado),
         horas = COALESCE($11, horas), formador = COALESCE($12, formador), activa = COALESCE($13, activa),
         cronograma = COALESCE($14::jsonb, cronograma) WHERE id = $1`,
      [id, d.dataInicio ?? null, d.nome ?? null, d.curso ?? null, d.ufcdCod ?? null, d.local ?? null, d.horario ?? null, d.alunos ?? null, d.alunosTotal ?? null, d.estado ?? null, d.horas ?? null, d.formador ?? null, d.activa ?? null, d.cronograma ?? null],
    );
    const row = await one(db, "SELECT * FROM turmas_fin WHERE id = $1", [id]);
    return { turma: row ? mapTurmaFin(row) : null };
  });
  app.delete("/v1/turmas-fin/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await db.query("DELETE FROM turmas_fin WHERE id = $1", [Number((req.params as { id: string }).id)]);
    return { ok: true };
  });

  const formadorSchema = z.object({
    nome: z.string().trim().min(1).max(120),
    telf: z.string().max(40).optional().default(""),
    email: z.string().max(254).optional().default(""),
    especialidade: z.string().max(160).optional().default(""),
    ccp: z.string().max(40).optional().default(""),
    nif: z.string().max(40).optional().default(""),
    regimes: z.array(z.enum(["gold", "fin"])).optional().default(["gold"]),
    estado: z.enum(["Ativo", "Inactivo"]).optional().default("Ativo"),
  });
  app.post("/v1/formadores", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = formadorSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const id = await nextOpsId(db);
    await db.query(
      "INSERT INTO formadores (id, nome, telf, email, especialidade, ccp, nif, regimes, estado) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)",
      [id, d.nome, d.telf, d.email, d.especialidade, d.ccp, d.nif, d.regimes, d.estado],
    );
    const row = await one(db, "SELECT * FROM formadores WHERE id = $1", [id]);
    return { formador: row ? mapFormador(row) : { id } };
  });
  app.patch("/v1/formadores/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = formadorSchema.partial().safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    await db.query(
      `UPDATE formadores SET nome = COALESCE($2, nome), telf = COALESCE($3, telf), email = COALESCE($4, email),
         especialidade = COALESCE($5, especialidade), ccp = COALESCE($6, ccp), nif = COALESCE($7, nif),
         regimes = COALESCE($8::jsonb, regimes), estado = COALESCE($9, estado) WHERE id = $1`,
      [id, d.nome ?? null, d.telf ?? null, d.email ?? null, d.especialidade ?? null, d.ccp ?? null, d.nif ?? null, d.regimes ?? null, d.estado ?? null],
    );
    const row = await one(db, "SELECT * FROM formadores WHERE id = $1", [id]);
    return { formador: row ? mapFormador(row) : null };
  });
  app.delete("/v1/formadores/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await db.query("DELETE FROM formadores WHERE id = $1", [Number((req.params as { id: string }).id)]);
    return { ok: true };
  });

  const campanhaSchema = z.object({
    nome: z.string().trim().min(1).max(120),
    data: z.string().max(20),
    encarregado: z.string().max(80).optional().default(""),
    curso: z.string().max(200).optional().default(""),
    custo: z.number().optional().default(0),
  });
  app.post("/v1/campanhas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = campanhaSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const id = await nextOpsId(db);
    await db.query(
      "INSERT INTO campanhas (id, nome, data, encarregado, preinscricoes, pagos, receita, custo, curso) VALUES ($1,$2,$3,$4,0,0,0,$5,$6)",
      [id, d.nome, d.data, d.encarregado, d.custo, d.curso || null],
    );
    const row = await one(db, "SELECT * FROM campanhas WHERE id = $1", [id]);
    return { campanha: row ? mapCampanha(row) : { id } };
  });
  app.patch("/v1/campanhas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = campanhaSchema.partial().safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    await db.query(
      `UPDATE campanhas SET nome = COALESCE($2, nome), data = COALESCE($3, data), encarregado = COALESCE($4, encarregado),
         custo = COALESCE($5, custo), curso = COALESCE($6, curso) WHERE id = $1`,
      [id, d.nome ?? null, d.data ?? null, d.encarregado ?? null, d.custo ?? null, d.curso ?? null],
    );
    const row = await one(db, "SELECT * FROM campanhas WHERE id = $1", [id]);
    return { campanha: row ? mapCampanha(row) : null };
  });
  app.delete("/v1/campanhas/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await db.query("DELETE FROM campanhas WHERE id = $1", [Number((req.params as { id: string }).id)]);
    return { ok: true };
  });

  const blogSchema = z.object({
    titulo: z.string().trim().min(1).max(200),
    slug: z.string().trim().min(1).max(200),
    data: z.string().max(20),
    status: z.string().max(20).optional().default("Ativo"),
    tematica: z.string().max(120).optional().default(""),
  });
  app.post("/v1/blog", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = blogSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const id = await nextOpsId(db);
    await db.query("INSERT INTO blog_posts (id, titulo, slug, data, status, tematica) VALUES ($1,$2,$3,$4,$5,$6)", [id, d.titulo, d.slug, d.data, d.status, d.tematica]);
    const row = await one(db, "SELECT * FROM blog_posts WHERE id = $1", [id]);
    return { post: row ? mapBlog(row) : { id } };
  });
  app.patch("/v1/blog/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = blogSchema.partial().safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    await db.query(
      "UPDATE blog_posts SET titulo = COALESCE($2, titulo), slug = COALESCE($3, slug), data = COALESCE($4, data), status = COALESCE($5, status), tematica = COALESCE($6, tematica) WHERE id = $1",
      [id, d.titulo ?? null, d.slug ?? null, d.data ?? null, d.status ?? null, d.tematica ?? null],
    );
    const row = await one(db, "SELECT * FROM blog_posts WHERE id = $1", [id]);
    return { post: row ? mapBlog(row) : null };
  });
  app.delete("/v1/blog/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await db.query("DELETE FROM blog_posts WHERE id = $1", [Number((req.params as { id: string }).id)]);
    return { ok: true };
  });

  const pagSchema = z.object({
    nome: z.string().trim().min(1).max(160),
    valor: z.number().min(0),
    metodo: z.string().max(60).optional().default("MB Way"),
    curso: z.string().max(200).optional().default(""),
    data: z.string().max(40).optional(),
    estado: z.string().max(20).optional().default("Pago"),
    email: z.string().max(254).optional(),
    referencia: z.string().max(40).optional(),
  });
  app.post("/v1/pagamentos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = pagSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const id = `TRX-${await nextOpsId(db)}`;
    const email = d.email ? normalizeEmail(d.email) : "";
    await db.query(
      "INSERT INTO pagamentos (id, nome, valor, metodo, curso, data, estado, email, referencia) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [id, d.nome, d.valor, d.metodo, d.curso, d.data || nowStamp(), d.estado, email, d.referencia ?? ""],
    );
    let mapped = null as ReturnType<typeof mapPagamento> | null;
    const row = await one(db, "SELECT * FROM pagamentos WHERE id = $1", [id]);
    if (row && /pago/i.test(d.estado)) mapped = await confirmarPagamento(db, row as Record<string, unknown>);
    else mapped = row ? mapPagamento(row as Record<string, unknown>) : { id, nome: d.nome, valor: d.valor, metodo: d.metodo, curso: d.curso, data: d.data || nowStamp(), estado: d.estado, email, referencia: d.referencia ?? "" };
    return { pagamento: mapped };
  });
  app.patch("/v1/pagamentos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = (req.params as { id: string }).id;
    const parsed = pagSchema.partial().safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const before = await one(db, "SELECT * FROM pagamentos WHERE id = $1", [id]);
    if (!before) return reply.code(404).send({ error: "pagamento inexistente" });
    await db.query(
      "UPDATE pagamentos SET nome = COALESCE($2, nome), valor = COALESCE($3, valor), metodo = COALESCE($4, metodo), curso = COALESCE($5, curso), data = COALESCE($6, data), estado = COALESCE($7, estado), email = COALESCE($8, email), referencia = COALESCE($9, referencia) WHERE id = $1",
      [id, d.nome ?? null, d.valor ?? null, d.metodo ?? null, d.curso ?? null, d.data ?? null, d.estado ?? null, d.email ? normalizeEmail(d.email) : null, d.referencia ?? null],
    );
    const row = await one(db, "SELECT * FROM pagamentos WHERE id = $1", [id]);
    const passouAPago = d.estado && /pago/i.test(d.estado) && !/pago/i.test(String((before as { estado?: string }).estado ?? ""));
    const mapped = row && passouAPago
      ? await confirmarPagamento(db, row as Record<string, unknown>)
      : row ? mapPagamento(row as Record<string, unknown>) : null;
    return { pagamento: mapped };
  });
  app.delete("/v1/pagamentos/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await db.query("DELETE FROM pagamentos WHERE id = $1", [(req.params as { id: string }).id]);
    return { ok: true };
  });

  async function webhookChave(db: Db) {
    if (config.paymentWebhookKey) return config.paymentWebhookKey;
    const row = await one(db, "SELECT values FROM app_settings WHERE id = $1", ["gold"]);
    const values = (row?.values ?? {}) as Record<string, string>;
    return String(values["Chave webhook pagamentos"] ?? values["chaveWebhook"] ?? "").trim();
  }

  async function handlePagamentoWebhook(req: FastifyRequest, reply: FastifyReply) {
    const q = req.query as Record<string, string | undefined>;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const chave = String(q.chave ?? q.key ?? body.chave ?? body.key ?? req.headers["x-webhook-key"] ?? "").trim();
    const expected = await webhookChave(db);
    if (!expected) return reply.code(503).send({ error: "webhook sem chave: grave-a em Configurações → Gold ou em PAYMENT_WEBHOOK_KEY" });
    if (chave !== expected) return reply.code(401).send({ error: "chave inválida" });
    const referencia = String(q.referencia ?? body.referencia ?? body.ref ?? "").trim();
    const id = String(q.id ?? body.id ?? "").trim();
    const valorRaw = q.valor ?? body.valor;
    const valor = valorRaw == null || valorRaw === "" ? undefined : Number(String(valorRaw).replace(",", "."));
    const found = id
      ? await one(db, "SELECT * FROM pagamentos WHERE id = $1", [id])
      : await findPagamentoPorReferencia(db, referencia, valor);
    if (!found) return reply.code(404).send({ error: "referência desconhecida" });
    const mapped = await confirmarPagamento(db, found as Record<string, unknown>);
    await audit(db, undefined, "pagamento.webhook", "pagamento", mapped.id, req.ip, { referencia, valor });
    return { ok: true, pagamento: mapped };
  }

  app.get("/v1/public/pagamentos/webhook", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, handlePagamentoWebhook);
  app.post("/v1/public/pagamentos/webhook", {
    config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
  }, handlePagamentoWebhook);
}
