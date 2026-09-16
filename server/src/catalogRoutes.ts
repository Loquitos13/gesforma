import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { isCatalogKind } from "./db/catalogSeed.js";
import type { Db } from "./db/pool.js";
import { nextOpsId } from "./ops.js";

const itemSchema = z.object({
  regime: z.enum(["gold", "fin"]).optional().default("gold"),
  payload: z.record(z.unknown()),
});

const settingsSchema = z.object({
  values: z.record(z.string().max(400)),
});

function kindOf(req: FastifyRequest) {
  const kind = (req.params as { kind?: string }).kind ?? "";
  return isCatalogKind(kind) ? kind : null;
}

export function registerCatalogRoutes(
  app: FastifyInstance,
  db: Db,
  helpers: {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => boolean;
  },
) {
  const { requireAuth } = helpers;

  app.post("/v1/catalog/:kind", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const kind = kindOf(req);
    const parsed = itemSchema.safeParse(req.body);
    if (!kind || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const raw = JSON.stringify(parsed.data.payload);
    if (raw.length > 20_000) return reply.code(400).send({ error: "payload demasiado grande" });
    const id = await nextOpsId(db);
    await db.query(
      "INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1,$2,$3,$4::jsonb)",
      [id, kind, parsed.data.regime, raw],
    );
    return { item: { id, ...parsed.data.payload } };
  });

  app.patch("/v1/catalog/:kind/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const kind = kindOf(req);
    const id = Number((req.params as { id: string }).id);
    const parsed = itemSchema.partial().safeParse(req.body);
    if (!kind || !Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const raw = parsed.data.payload ? JSON.stringify(parsed.data.payload) : null;
    if (raw && raw.length > 20_000) return reply.code(400).send({ error: "payload demasiado grande" });
    await db.query(
      `UPDATE catalog_items SET
         payload = COALESCE($3::jsonb, payload),
         regime = COALESCE($4, regime),
         updated_at = now()
       WHERE id = $1 AND kind = $2`,
      [id, kind, raw, parsed.data.regime ?? null],
    );
    const row = await db.query("SELECT id, payload FROM catalog_items WHERE id = $1 AND kind = $2", [id, kind]);
    const payload = (row.rows[0]?.payload ?? {}) as Record<string, unknown>;
    return { item: row.rows[0] ? { id, ...payload } : null };
  });

  app.delete("/v1/catalog/:kind/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const kind = kindOf(req);
    const id = Number((req.params as { id: string }).id);
    if (!kind || !Number.isInteger(id)) return reply.code(400).send({ error: "pedido inválido" });
    await db.query("DELETE FROM catalog_items WHERE id = $1 AND kind = $2", [id, kind]);
    return { ok: true };
  });

  app.get("/v1/settings", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await db.query<{ id: string; values: Record<string, string> }>("SELECT id, values FROM app_settings");
    return { settings: Object.fromEntries(rows.rows.map(r => [r.id, r.values])) };
  });

  app.put("/v1/settings/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = String((req.params as { id: string }).id).slice(0, 40);
    const parsed = settingsSchema.safeParse(req.body);
    if (!id || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    await db.query(
      `INSERT INTO app_settings (id, values) VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO UPDATE SET values = EXCLUDED.values, updated_at = now()`,
      [id, JSON.stringify(parsed.data.values)],
    );
    return { ok: true, id, values: parsed.data.values };
  });
}
