import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { isCatalogKind } from "./db/catalogSeed.js";
import type { Db } from "./db/pool.js";
import { guardarImagemHero } from "./cursoImagens.js";
import { nextOpsId } from "./ops.js";

const itemSchema = z.object({
  regime: z.enum(["gold", "fin"]).optional().default("gold"),
  payload: z.record(z.unknown()),
});

const settingsSchema = z.object({
  values: z.record(z.string().max(400)),
});

const siteSchema = z.object({
  values: z.record(z.string().max(800)),
});

function valoresDoSite(values: Record<string, string>) {
  const out: Record<string, string> = {};
  for (const [chave, valor] of Object.entries(values)) {
    if (/^[a-zA-Z][a-zA-Z0-9]{0,40}$/.test(chave)) out[chave] = valor.trim().slice(0, 800);
  }
  return out;
}

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
    if (JSON.stringify(parsed.data.payload).length > 20_000) return reply.code(400).send({ error: "payload demasiado grande" });
    const id = await nextOpsId(db);
    await db.query(
      "INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1,$2,$3,$4::jsonb)",
      [id, kind, parsed.data.regime, parsed.data.payload],
    );
    return { item: { id, ...parsed.data.payload } };
  });

  app.patch("/v1/catalog/:kind/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const kind = kindOf(req);
    const id = Number((req.params as { id: string }).id);
    const parsed = itemSchema.partial().safeParse(req.body);
    if (!kind || !Number.isInteger(id) || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    if (parsed.data.payload && JSON.stringify(parsed.data.payload).length > 20_000) {
      return reply.code(400).send({ error: "payload demasiado grande" });
    }
    await db.query(
      `UPDATE catalog_items SET
         payload = COALESCE($3::jsonb, payload),
         regime = COALESCE($4, regime),
         updated_at = now()
       WHERE id = $1 AND kind = $2`,
      [id, kind, parsed.data.payload ?? null, parsed.data.regime ?? null],
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

  app.get("/v1/public/opcoes", async (req) => {
    const lista = String((req.query as { lista?: string }).lista ?? "").trim().slice(0, 80);
    if (!/^[a-z][a-z0-9_]{1,40}$/.test(lista)) return { lista: "", opcoes: [] as string[] };
    const rows = await db.query<{ nome: string }>(
      `SELECT payload->>'nome' AS nome
         FROM catalog_items
        WHERE kind = 'lista_opcoes' AND payload->>'lista' = $1
        ORDER BY id`,
      [lista],
    );
    return { lista, opcoes: rows.rows.map(r => r.nome).filter(Boolean) };
  });

  app.get("/v1/public/site", async (_req, reply) => {
    reply.header("cache-control", "no-store");
    const row = await db.query<{ values: unknown }>("SELECT values FROM app_settings WHERE id = 'site'");
    const raw = row.rows[0]?.values;
    const valores: Record<string, string> = {};
    if (raw && typeof raw === "object") {
      for (const [chave, valor] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof valor === "string") valores[chave] = valor;
      }
    }
    return { valores };
  });

  app.get("/v1/settings", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const rows = await db.query<{ id: string; values: Record<string, string> }>("SELECT id, values FROM app_settings");
    return { settings: Object.fromEntries(rows.rows.map(r => [r.id, r.values])) };
  });

  app.put("/v1/settings/:id", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    const id = String((req.params as { id: string }).id).slice(0, 40);
    if (id === "site" && req.actor?.role !== "admin") {
      return reply.code(403).send({ error: "só o administrador edita o site" });
    }
    const parsed = (id === "site" ? siteSchema : settingsSchema).safeParse(req.body);
    if (!id || !parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const values = id === "site" ? valoresDoSite(parsed.data.values) : parsed.data.values;
    await db.query(
      `INSERT INTO app_settings (id, values) VALUES ($1, $2::jsonb)
       ON CONFLICT (id) DO UPDATE SET values = EXCLUDED.values, updated_at = now()`,
      [id, values],
    );
    return { ok: true, id, values };
  });

  app.post("/v1/site/hero/:slot/imagem", async (req, reply) => {
    if (!requireAuth(req, reply)) return;
    if (req.actor?.role !== "admin") return reply.code(403).send({ error: "só o administrador edita o site" });
    const slot = String((req.params as { slot?: string }).slot ?? "");
    if (slot !== "1" && slot !== "2") return reply.code(400).send({ error: "pedido inválido" });
    let nome = "hero.jpg";
    let mime = "";
    let bytes: Buffer | null = null;
    try {
      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === "file") {
          nome = part.filename || nome;
          mime = part.mimetype || mime;
          bytes = await part.toBuffer();
        }
      }
    } catch {
      return reply.code(400).send({ error: "upload inválido" });
    }
    if (!bytes?.length) return reply.code(400).send({ error: "ficheiro em falta" });
    try {
      return await guardarImagemHero(db, slot, { nome, mime, bytes });
    } catch (err) {
      return reply.code(400).send({ error: err instanceof Error ? err.message : "upload recusado" });
    }
  });
}
