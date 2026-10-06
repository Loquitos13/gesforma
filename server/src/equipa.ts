import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Db } from "./db/pool.js";
import { logLeadEvent } from "./crmDossier.js";
import { mapPreinscricao, nextOpsId } from "./ops.js";

const ESTADOS_PROPOSTA = ["Enviada", "Negociação", "Aceite", "Recusada", "Expirada"] as const;

const propostaSchema = z.object({
  comercialId: z.string().uuid().optional(),
  preinscricaoId: z.number().int().positive().optional().nullable(),
  clienteNome: z.string().trim().min(2).max(160),
  clienteEmail: z.string().trim().max(254).optional().default(""),
  curso: z.string().trim().max(200).optional().default(""),
  valor: z.number().min(0).max(50000).optional().default(0),
  estado: z.enum(ESTADOS_PROPOSTA).optional().default("Enviada"),
  respostaCliente: z.string().trim().max(4000).optional().default(""),
  notas: z.string().trim().max(4000).optional().default(""),
  corpo: z.string().max(8000).optional().default(""),
  templateId: z.number().int().positive().nullable().optional(),
  clienteId: z.number().int().positive().nullable().optional(),
  regime: z.enum(["gold", "fin"]).optional(),
});

const patchPropostaSchema = z.object({
  estado: z.enum(ESTADOS_PROPOSTA).optional(),
  respostaCliente: z.string().trim().max(4000).optional(),
  valor: z.number().min(0).max(50000).optional(),
  notas: z.string().trim().max(4000).optional(),
  curso: z.string().trim().max(200).optional(),
}).refine(v => Object.keys(v).length > 0, { message: "vazio" });

const notaSchema = z.object({
  preinscricaoId: z.number().int().positive(),
  nota: z.string().trim().min(1).max(4000),
});

function regimeDe(raw: unknown): "gold" | "fin" {
  return raw === "fin" ? "fin" : "gold";
}

function roleDaEquipa(regime: "gold" | "fin") {
  return regime === "fin" ? "financiada" : "comercial";
}

function canSeeEquipa(role: string | undefined, regime: "gold" | "fin") {
  if (role === "admin" || role === "secretaria") return true;
  return role === roleDaEquipa(regime);
}

function requireEquipa(req: FastifyRequest, reply: FastifyReply, requireAuth: (req: FastifyRequest, reply: FastifyReply) => boolean, regime: "gold" | "fin") {
  if (!requireAuth(req, reply)) return false;
  if (!canSeeEquipa(req.actor?.role, regime)) {
    reply.code(403).send({ error: "sem acesso a esta equipa" });
    return false;
  }
  return true;
}

function asIso(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function num(v: unknown) {
  return typeof v === "number" ? v : Number(v ?? 0);
}

type ComercialRow = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  last_login_at: string | Date | null;
};

function mapComercial(row: ComercialRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    active: row.active,
    lastLoginAt: asIso(row.last_login_at),
  };
}

function mapProposta(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    comercialId: String(r.comercial_id ?? ""),
    preinscricaoId: r.preinscricao_id == null ? null : num(r.preinscricao_id),
    clienteNome: String(r.cliente_nome ?? ""),
    clienteEmail: String(r.cliente_email ?? ""),
    curso: String(r.curso ?? ""),
    valor: num(r.valor),
    estado: String(r.estado ?? "Enviada"),
    respostaCliente: String(r.resposta_cliente ?? ""),
    respostaEm: asIso(r.resposta_em as string | Date | null),
    enviadaEm: asIso(r.enviada_em as string | Date | null),
    notas: String(r.notas ?? ""),
  };
}

function mapNota(r: Record<string, unknown>) {
  return {
    id: num(r.id),
    preinscricaoId: num(r.preinscricao_id),
    leadNome: `${r.lead_nome ?? ""} ${r.lead_apelido ?? ""}`.trim(),
    leadCurso: String(r.lead_curso ?? ""),
    nota: String(r.nota ?? ""),
    createdAt: asIso(r.created_at as string | Date | null),
  };
}

async function statsFor(db: Db, comercialId: string, regime: "gold" | "fin") {
  const leads = await db.query<{ estado: string; n: number; valor: number }>(
    `SELECT estado, count(*)::int AS n, coalesce(sum(preco),0)::float AS valor
       FROM preinscricoes WHERE comercial_id = $1 AND regime = $2
     GROUP BY estado`,
    [comercialId, regime],
  );
  const props = await db.query<{ estado: string; n: number; valor: number }>(
    `SELECT estado, count(*)::int AS n, coalesce(sum(valor),0)::float AS valor
       FROM propostas_comerciais WHERE comercial_id = $1 AND regime = $2
     GROUP BY estado`,
    [comercialId, regime],
  );
  const byLead = Object.fromEntries(leads.rows.map(r => [r.estado, { n: r.n, valor: r.valor }]));
  const byProp = Object.fromEntries(props.rows.map(r => [r.estado, { n: r.n, valor: r.valor }]));
  const leadsTotal = leads.rows.reduce((a, r) => a + r.n, 0);
  const pagos = (byLead["Pago"]?.n ?? 0) + (byLead["Formando"]?.n ?? 0);
  const propostasTotal = props.rows.reduce((a, r) => a + r.n, 0);
  const propostasAceites = byProp["Aceite"]?.n ?? 0;
  const meta = await db.query<{ meta_pct: unknown; meta_leads: unknown; meta_propostas: unknown; telefone: string; nota: string }>(
    "SELECT meta_pct, meta_leads, meta_propostas, telefone, nota FROM comercial_objetivos WHERE comercial_id = $1",
    [comercialId],
  );
  const pipeline = props.rows.filter(r => r.estado === "Enviada" || r.estado === "Negociação").reduce((a, r) => a + r.valor, 0);
  const receita = (byLead["Pago"]?.valor ?? 0) + (byLead["Formando"]?.valor ?? 0);
  return {
    leads: leadsTotal,
    porContactar: byLead["Não contactado"]?.n ?? 0,
    emConversa: (byLead["1º Contacto"]?.n ?? 0) + (byLead["2º Contacto"]?.n ?? 0),
    pagos,
    conversao: leadsTotal ? Math.round((pagos / leadsTotal) * 100) : 0,
    propostas: propostasTotal,
    propostasAceites,
    sucessoPropostas: propostasTotal ? Math.round((propostasAceites / propostasTotal) * 100) : 0,
    metaPct: meta.rows[0] ? Number(meta.rows[0].meta_pct) : null,
    metaLeads: meta.rows[0] ? Number(meta.rows[0].meta_leads) : 0,
    metaPropostas: meta.rows[0] ? Number(meta.rows[0].meta_propostas) : 0,
    telefone: String(meta.rows[0]?.telefone ?? ""),
    nota: String(meta.rows[0]?.nota ?? ""),
    propostasRecusadas: byProp["Recusada"]?.n ?? 0,
    pipeline,
    receita,
  };
}

export function registerEquipaRoutes(
  app: FastifyInstance,
  db: Db,
  helpers: {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => boolean;
    audit: (db: Db, actorId: string | undefined, action: string, entity: string, entityId?: string, ip?: string, meta?: Record<string, unknown>) => Promise<void>;
  },
) {
  const { requireAuth, audit } = helpers;

  app.get("/v1/equipa", async (req, reply) => {
    const regime = regimeDe((req.query as { regime?: string } | undefined)?.regime);
    if (!requireEquipa(req, reply, requireAuth, regime)) return;
    const rows = await db.query<ComercialRow>(
      `SELECT u.id, u.name, u.email, u.active,
              (SELECT max(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_login_at
         FROM users u
        WHERE u.role = $1
        ORDER BY u.active DESC, u.name ASC`,
      [roleDaEquipa(regime)],
    );
    const comerciais = [];
    for (const row of rows.rows) {
      comerciais.push({ ...mapComercial(row), stats: await statsFor(db, row.id, regime) });
    }
    const totais = comerciais.reduce((acc, c) => ({
      comerciais: acc.comerciais + 1,
      activos: acc.activos + (c.active ? 1 : 0),
      leads: acc.leads + c.stats.leads,
      propostas: acc.propostas + c.stats.propostas,
      pipeline: acc.pipeline + c.stats.pipeline,
      receita: acc.receita + c.stats.receita,
    }), { comerciais: 0, activos: 0, leads: 0, propostas: 0, pipeline: 0, receita: 0 });
    return { totais, comerciais };
  });

  app.get("/v1/equipa/:id", async (req, reply) => {
    const regime = regimeDe((req.query as { regime?: string } | undefined)?.regime);
    if (!requireEquipa(req, reply, requireAuth, regime)) return;
    const id = (req.params as { id: string }).id;
    const row = await db.query<ComercialRow>(
      `SELECT u.id, u.name, u.email, u.active,
              (SELECT max(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_login_at
         FROM users u WHERE u.id = $1 AND u.role = $2`,
      [id, roleDaEquipa(regime)],
    );
    const comercial = row.rows[0];
    if (!comercial) return reply.code(404).send({ error: "comercial não encontrado" });

    const leadsQ = await db.query("SELECT * FROM preinscricoes WHERE comercial_id = $1 AND regime = $2 ORDER BY inscrito DESC LIMIT 200", [id, regime]);
    const propsQ = await db.query("SELECT * FROM propostas_comerciais WHERE comercial_id = $1 AND regime = $2 ORDER BY enviada_em DESC LIMIT 200", [id, regime]);
    const notasQ = await db.query(
      `SELECT c.id, c.preinscricao_id, c.nota, c.created_at,
              p.nome AS lead_nome, p.apelido AS lead_apelido, p.curso AS lead_curso
         FROM preinscricao_contactos c
         JOIN preinscricoes p ON p.id = c.preinscricao_id
        WHERE p.comercial_id = $1 AND p.regime = $2
        ORDER BY c.created_at DESC
        LIMIT 200`,
      [id, regime],
    );

    return {
      comercial: { ...mapComercial(comercial), stats: await statsFor(db, id, regime) },
      propostas: propsQ.rows.map(r => mapProposta(r as Record<string, unknown>)),
      leads: leadsQ.rows.map(r => mapPreinscricao(r as Record<string, unknown>)),
      notas: notasQ.rows.map(r => mapNota(r as Record<string, unknown>)),
    };
  });

  app.post("/v1/equipa/:id/propostas", async (req, reply) => {
    const comercialId = (req.params as { id: string }).id;
    const parsed = propostaSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const regime = regimeDe(parsed.data.regime);
    if (!requireEquipa(req, reply, requireAuth, regime)) return;
    const exists = await db.query<{ id: string }>("SELECT id FROM users WHERE id = $1 AND role = $2", [comercialId, roleDaEquipa(regime)]);
    if (!exists.rows[0]) return reply.code(404).send({ error: "comercial não encontrado" });
    const d = parsed.data;
    let curso = d.curso;
    let valor = d.valor ?? 0;
    let corpo = d.corpo;
    if (d.templateId) {
      const tpl = await db.query<{ curso: string; valor: unknown; corpo: string }>(
        "SELECT curso, valor, corpo FROM proposta_templates WHERE id = $1",
        [d.templateId],
      );
      const t = tpl.rows[0];
      if (t) {
        curso = curso || t.curso;
        if (!valor) valor = Number(t.valor ?? 0);
        corpo = corpo || t.corpo;
      }
    }
    const pid = await nextOpsId(db);
    const respostaEm = d.respostaCliente ? new Date() : null;
    await db.query(
      `INSERT INTO propostas_comerciais
         (id, comercial_id, preinscricao_id, cliente_id, cliente_nome, cliente_email, curso, valor, estado, resposta_cliente, resposta_em, notas, regime, corpo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [pid, comercialId, d.preinscricaoId ?? null, d.clienteId ?? null, d.clienteNome, d.clienteEmail, curso, valor, d.estado ?? "Enviada", d.respostaCliente, respostaEm, d.notas, regime, corpo],
    );
    if (d.preinscricaoId) {
      await db.query("UPDATE preinscricoes SET comercial_id = COALESCE(comercial_id, $2) WHERE id = $1", [d.preinscricaoId, comercialId]);
      await logLeadEvent(db, d.preinscricaoId, req.actor!.id, "proposta", `Proposta ${d.estado ?? "Enviada"}`, `${d.curso} · € ${d.valor ?? 0}`);
    }
    await audit(db, req.actor!.id, "proposta.create", "proposta", String(pid), req.ip, { comercialId });
    const row = await db.query("SELECT * FROM propostas_comerciais WHERE id = $1", [pid]);
    return { proposta: row.rows[0] ? mapProposta(row.rows[0] as Record<string, unknown>) : { id: pid } };
  });

  app.patch("/v1/equipa/propostas/:pid", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const pid = Number((req.params as { pid: string }).pid);
    const parsed = patchPropostaSchema.safeParse(req.body);
    if (!Number.isInteger(pid) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const d = parsed.data;
    const current = await db.query("SELECT * FROM propostas_comerciais WHERE id = $1", [pid]);
    if (!current.rows[0]) return reply.code(404).send({ error: "proposta não encontrada" });
    const regime = regimeDe((current.rows[0] as { regime?: string }).regime);
    if (!canSeeEquipa(req.actor?.role, regime)) return reply.code(403).send({ error: "sem acesso a esta equipa" });
    const resposta = d.respostaCliente;
    await db.query(
      `UPDATE propostas_comerciais SET
         estado = COALESCE($2, estado),
         resposta_cliente = COALESCE($3, resposta_cliente),
         valor = COALESCE($4, valor),
         notas = COALESCE($5, notas),
         curso = COALESCE($6, curso),
         resposta_em = CASE WHEN $3 IS NOT NULL AND $3 <> '' THEN now() ELSE resposta_em END
       WHERE id = $1`,
      [pid, d.estado ?? null, resposta ?? null, d.valor ?? null, d.notas ?? null, d.curso ?? null],
    );
    await audit(db, req.actor!.id, "proposta.update", "proposta", String(pid), req.ip);
    const row = await db.query("SELECT * FROM propostas_comerciais WHERE id = $1", [pid]);
    return { proposta: mapProposta(row.rows[0] as Record<string, unknown>) };
  });

  app.post("/v1/equipa/:id/notas", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const comercialId = (req.params as { id: string }).id;
    const parsed = notaSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const lead = await db.query<{ id: number; notas: string; regime: string }>("SELECT id, notas, regime FROM preinscricoes WHERE id = $1", [parsed.data.preinscricaoId]);
    if (!lead.rows[0]) return reply.code(404).send({ error: "lead não encontrado" });
    if (!canSeeEquipa(req.actor?.role, regimeDe(lead.rows[0].regime))) {
      return reply.code(403).send({ error: "sem acesso a esta equipa" });
    }
    await db.query("UPDATE preinscricoes SET comercial_id = COALESCE(comercial_id, $2) WHERE id = $1", [parsed.data.preinscricaoId, comercialId]);
    await db.query(
      "INSERT INTO preinscricao_contactos (preinscricao_id, actor_id, nota) VALUES ($1,$2,$3)",
      [parsed.data.preinscricaoId, req.actor!.id, parsed.data.nota],
    );
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const line = `[${stamp}] ${parsed.data.nota}`;
    await db.query(
      "UPDATE preinscricoes SET notas = CASE WHEN notas = '' THEN $2 ELSE trim(both from notas || E'\\n' || $2) END WHERE id = $1",
      [parsed.data.preinscricaoId, line],
    );
    await audit(db, req.actor!.id, "equipa.nota", "preinscricao", String(parsed.data.preinscricaoId), req.ip);
    await logLeadEvent(db, parsed.data.preinscricaoId, req.actor!.id, "nota", "Nota comercial", parsed.data.nota);
    return { ok: true };
  });

  app.put("/v1/equipa/:id/objetivo", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor!.role !== "admin" && req.actor!.role !== "secretaria") {
      return reply.code(403).send({ error: "Sem permissão para definir o objectivo." });
    }
    const comercialId = (req.params as { id: string }).id;
    const parsed = z.object({
      metaPct: z.number().min(0).max(100).optional(),
      metaLeads: z.number().int().min(0).max(100000).optional(),
      metaPropostas: z.number().int().min(0).max(100000).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    await db.query(
      `INSERT INTO comercial_objetivos (comercial_id, meta_pct, meta_leads, meta_propostas, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (comercial_id) DO UPDATE SET
         meta_pct = COALESCE($2, comercial_objetivos.meta_pct),
         meta_leads = COALESCE($3, comercial_objetivos.meta_leads),
         meta_propostas = COALESCE($4, comercial_objetivos.meta_propostas),
         updated_at = now()`,
      [comercialId, parsed.data.metaPct ?? null, parsed.data.metaLeads ?? null, parsed.data.metaPropostas ?? null],
    );
    await audit(db, req.actor!.id, "equipa.objetivo", "user", comercialId, req.ip, parsed.data);
    return { ok: true, ...parsed.data };
  });

  app.patch("/v1/equipa/:id/perfil", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor!.role !== "admin" && req.actor!.role !== "secretaria") {
      return reply.code(403).send({ error: "Sem permissão para editar o perfil comercial." });
    }
    const comercialId = (req.params as { id: string }).id;
    const parsed = z.object({
      name: z.string().trim().min(2).max(120).optional(),
      telefone: z.string().max(40).optional(),
      nota: z.string().max(2000).optional(),
    }).safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const exists = await db.query<{ id: string }>("SELECT id FROM users WHERE id = $1 AND role = 'comercial'", [comercialId]);
    if (!exists.rows[0]) return reply.code(404).send({ error: "comercial inexistente" });
    if (parsed.data.name) {
      await db.query("UPDATE users SET name = $2 WHERE id = $1", [comercialId, parsed.data.name]);
    }
    await db.query(
      `INSERT INTO comercial_objetivos (comercial_id, telefone, nota, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (comercial_id) DO UPDATE SET
         telefone = COALESCE($2, comercial_objetivos.telefone),
         nota = COALESCE($3, comercial_objetivos.nota),
         updated_at = now()`,
      [comercialId, parsed.data.telefone ?? null, parsed.data.nota ?? null],
    );
    await audit(db, req.actor!.id, "equipa.perfil", "user", comercialId, req.ip);
    return { ok: true };
  });
}
