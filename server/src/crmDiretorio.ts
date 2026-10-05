import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Db } from "./db/pool.js";
import { nextOpsId } from "./ops.js";

function num(v: unknown) {
  return typeof v === "number" ? v : Number(v ?? 0);
}

export function registerCrmDiretorioRoutes(
  app: FastifyInstance,
  db: Db,
  helpers: { requireAuth: (req: FastifyRequest, reply: FastifyReply) => boolean },
) {
  const { requireAuth } = helpers;

  app.get("/v1/crm/clientes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await db.query(
      "SELECT id, nome, email, telf, nif, notas, created_at FROM crm_clientes ORDER BY nome ASC LIMIT 500",
    );
    return { clientes: rows.rows.map(r => ({
      id: num(r.id), nome: String(r.nome), email: String(r.email ?? ""), telf: String(r.telf ?? ""),
      nif: String(r.nif ?? ""), notas: String(r.notas ?? ""),
    })) };
  });

  const clienteSchema = z.object({
    nome: z.string().trim().min(1).max(160),
    email: z.string().max(160).optional().default(""),
    telf: z.string().max(40).optional().default(""),
    nif: z.string().max(20).optional().default(""),
    notas: z.string().max(2000).optional().default(""),
  });

  app.post("/v1/crm/clientes", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = clienteSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const row = await db.query<{ id: number }>(
      "INSERT INTO crm_clientes (nome, email, telf, nif, notas) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [d.nome, d.email, d.telf, d.nif, d.notas],
    );
    return { cliente: { id: row.rows[0]!.id, ...d } };
  });

  app.patch("/v1/crm/clientes/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = Number((req.params as { id: string }).id);
    const parsed = clienteSchema.partial().safeParse(req.body);
    if (!Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    await db.query(
      `UPDATE crm_clientes SET nome = COALESCE($2, nome), email = COALESCE($3, email), telf = COALESCE($4, telf),
         nif = COALESCE($5, nif), notas = COALESCE($6, notas) WHERE id = $1`,
      [id, d.nome ?? null, d.email ?? null, d.telf ?? null, d.nif ?? null, d.notas ?? null],
    );
    return { ok: true };
  });

  app.delete("/v1/crm/clientes/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await db.query("DELETE FROM crm_clientes WHERE id = $1", [Number((req.params as { id: string }).id)]);
    return { ok: true };
  });

  app.get("/v1/crm/parceiros", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await db.query(
      "SELECT id, nome, email, telf, tipo, notas FROM crm_parceiros ORDER BY nome ASC LIMIT 500",
    );
    return { parceiros: rows.rows.map(r => ({
      id: num(r.id), nome: String(r.nome), email: String(r.email ?? ""), telf: String(r.telf ?? ""),
      tipo: String(r.tipo ?? ""), notas: String(r.notas ?? ""),
    })) };
  });

  const parceiroSchema = z.object({
    nome: z.string().trim().min(1).max(160),
    email: z.string().max(160).optional().default(""),
    telf: z.string().max(40).optional().default(""),
    tipo: z.string().max(80).optional().default(""),
    notas: z.string().max(2000).optional().default(""),
  });

  app.post("/v1/crm/parceiros", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = parceiroSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const row = await db.query<{ id: number }>(
      "INSERT INTO crm_parceiros (nome, email, telf, tipo, notas) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [d.nome, d.email, d.telf, d.tipo, d.notas],
    );
    return { parceiro: { id: row.rows[0]!.id, ...d } };
  });

  app.delete("/v1/crm/parceiros/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    await db.query("DELETE FROM crm_parceiros WHERE id = $1", [Number((req.params as { id: string }).id)]);
    return { ok: true };
  });

  const templateSchema = z.object({
    nome: z.string().trim().min(1).max(120),
    curso: z.string().max(200).optional().default(""),
    valor: z.number().optional().default(0),
    corpo: z.string().max(8000).optional().default(""),
  });

  app.get("/v1/crm/proposta-templates", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await db.query("SELECT id, nome, curso, valor, corpo FROM proposta_templates ORDER BY nome ASC");
    return { templates: rows.rows.map(r => ({ id: num(r.id), nome: String(r.nome), curso: String(r.curso ?? ""), valor: num(r.valor), corpo: String(r.corpo ?? "") })) };
  });

  app.post("/v1/crm/proposta-templates", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor!.role !== "admin" && req.actor!.role !== "secretaria") {
      return reply.code(403).send({ error: "Só a administração ou a secretaria cria templates." });
    }
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const row = await db.query<{ id: number }>(
      "INSERT INTO proposta_templates (nome, curso, valor, corpo) VALUES ($1,$2,$3,$4) RETURNING id",
      [d.nome, d.curso, d.valor, d.corpo],
    );
    return { template: { id: row.rows[0]!.id, ...d } };
  });

  app.get("/v1/crm/contrato-templates", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await db.query("SELECT id, nome, curso, valor, corpo FROM contrato_templates ORDER BY nome ASC");
    return { templates: rows.rows.map(r => ({ id: num(r.id), nome: String(r.nome), curso: String(r.curso ?? ""), valor: num(r.valor), corpo: String(r.corpo ?? "") })) };
  });

  app.post("/v1/crm/contrato-templates", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor!.role !== "admin" && req.actor!.role !== "secretaria") {
      return reply.code(403).send({ error: "Só a administração ou a secretaria cria templates." });
    }
    const parsed = templateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const row = await db.query<{ id: number }>(
      "INSERT INTO contrato_templates (nome, curso, valor, corpo) VALUES ($1,$2,$3,$4) RETURNING id",
      [d.nome, d.curso, d.valor, d.corpo],
    );
    return { template: { id: row.rows[0]!.id, ...d } };
  });

  app.get("/v1/crm/contratos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await db.query(
      `SELECT c.id, c.cliente_nome, c.cliente_email, c.curso, c.valor, c.estado, c.notas, c.corpo, c.template_id, u.name AS comercial
         FROM contratos_comerciais c
         LEFT JOIN users u ON u.id = c.comercial_id
        ORDER BY c.created_at DESC LIMIT 300`,
    );
    return { contratos: rows.rows.map(r => ({
      id: num(r.id),
      clienteNome: String(r.cliente_nome ?? ""),
      clienteEmail: String(r.cliente_email ?? ""),
      curso: String(r.curso ?? ""),
      valor: num(r.valor),
      estado: String(r.estado ?? ""),
      notas: String(r.notas ?? ""),
      corpo: String(r.corpo ?? ""),
      templateId: r.template_id == null ? null : num(r.template_id),
      comercial: String(r.comercial ?? ""),
    })) };
  });

  const contratoSchema = z.object({
    clienteNome: z.string().trim().min(1).max(160),
    clienteEmail: z.string().max(160).optional().default(""),
    curso: z.string().max(200).optional().default(""),
    valor: z.number().optional().default(0),
    notas: z.string().max(4000).optional().default(""),
    corpo: z.string().max(8000).optional().default(""),
    templateId: z.number().int().positive().nullable().optional(),
    comercialId: z.string().uuid().optional(),
  });

  app.post("/v1/crm/contratos", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const parsed = contratoSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    let corpo = d.corpo;
    let curso = d.curso;
    let valor = d.valor;
    if (d.templateId && !corpo) {
      const tpl = await db.query<{ corpo: string; curso: string; valor: unknown }>(
        "SELECT corpo, curso, valor FROM contrato_templates WHERE id = $1",
        [d.templateId],
      );
      const t = tpl.rows[0];
      if (t) {
        corpo = corpo || String(t.corpo ?? "");
        curso = curso || String(t.curso ?? "");
        if (!valor) valor = num(t.valor);
      }
    }
    const comercialId = d.comercialId || req.actor!.id;
    const id = await nextOpsId(db);
    await db.query(
      `INSERT INTO contratos_comerciais (id, comercial_id, cliente_nome, cliente_email, curso, valor, estado, notas, corpo, template_id, assinado_em)
       VALUES ($1,$2,$3,$4,$5,$6,'Rascunho',$7,$8,$9,NULL)`,
      [id, comercialId, d.clienteNome, d.clienteEmail, curso, valor, d.notas, corpo, d.templateId ?? null],
    );
    return { contrato: { id, clienteNome: d.clienteNome, curso, valor, corpo } };
  });
}
