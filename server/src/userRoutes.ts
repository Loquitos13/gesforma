import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import type { Db } from "./db/pool.js";
import { mensagemPalavraPasse, palavraPasseValida } from "../../src/passwordPolicy.js";
import { hashPassword, isEmail, normalizeEmail } from "./security.js";

const ROLES = ["admin", "secretaria", "comercial", "financiada", "formador"] as const;
export type StaffRole = (typeof ROLES)[number];

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().max(254),
  password: z.string().min(1).max(200),
  role: z.enum(ROLES).default("secretaria"),
  active: z.boolean().optional().default(true),
  mustChangePassword: z.boolean().optional().default(false),
});

const patchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  email: z.string().max(254).optional(),
  role: z.enum(ROLES).optional(),
  active: z.boolean().optional(),
}).refine(v => Object.keys(v).length > 0, { message: "vazio" });

const passwordSchema = z.object({
  password: z.string().min(1).max(200),
  revokeSessions: z.boolean().optional(),
});

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  active: boolean;
  created_at: string | Date;
  last_login_at: string | Date | null;
  sessions_open: number;
};

function asIso(value: string | Date | null | undefined) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapUser(row: UserRow) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    active: row.active,
    created_at: asIso(row.created_at) ?? new Date().toISOString(),
    last_login_at: asIso(row.last_login_at),
    sessions_open: Number(row.sessions_open) || 0,
  };
}

const USER_SELECT = `
  SELECT u.id, u.name, u.email, u.role, u.active, u.created_at,
         (SELECT max(s.created_at) FROM sessions s WHERE s.user_id = u.id) AS last_login_at,
         (SELECT count(*)::int FROM sessions s WHERE s.user_id = u.id AND s.expires_at > now()) AS sessions_open
    FROM users u
`;

function isUniqueViolation(err: unknown) {
  const code = typeof err === "object" && err && "code" in err ? String((err as { code?: string }).code) : "";
  const msg = err instanceof Error ? err.message : "";
  return code === "23505" || /unique|duplicate/i.test(msg);
}

async function loadUser(db: Db, id: string) {
  const row = await db.query<UserRow>(`${USER_SELECT} WHERE u.id = $1`, [id]);
  return row.rows[0] ? mapUser(row.rows[0]) : null;
}

async function adminCount(db: Db, exceptId?: string) {
  const q = exceptId
    ? await db.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND active = true AND id <> $1",
      [exceptId],
    )
    : await db.query<{ n: number }>("SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND active = true");
  return q.rows[0]?.n ?? 0;
}

function requireAdmin(req: FastifyRequest, reply: FastifyReply, requireAuth: (req: FastifyRequest, reply: FastifyReply) => boolean) {
  if (!requireAuth(req, reply)) return false;
  if (req.actor?.role !== "admin") {
    reply.code(403).send({ error: "só a administração gere utilizadores" });
    return false;
  }
  return true;
}

export function registerUserRoutes(
  app: FastifyInstance,
  db: Db,
  helpers: {
    requireAuth: (req: FastifyRequest, reply: FastifyReply) => boolean;
    audit: (db: Db, actorId: string | undefined, action: string, entity: string, entityId?: string, ip?: string, meta?: Record<string, unknown>) => Promise<void>;
  },
) {
  const { requireAuth, audit } = helpers;

  app.get("/v1/users", async (req, reply) => {
    if (!requireAdmin(req, reply, requireAuth)) return;
    const rows = await db.query<UserRow>(`${USER_SELECT} ORDER BY u.active DESC, u.name ASC`);
    return { users: rows.rows.map(mapUser) };
  });

  app.post("/v1/users", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    if (!requireAdmin(req, reply, requireAuth)) return;
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "pedido inválido" });
    const email = normalizeEmail(parsed.data.email);
    if (!isEmail(email)) return reply.code(400).send({ error: "email inválido" });
    if (!palavraPasseValida(parsed.data.password)) {
      return reply.code(400).send({ error: mensagemPalavraPasse(parsed.data.password) });
    }
    const id = randomUUID();
    try {
      await db.query(
        "INSERT INTO users (id, name, email, password_hash, role, active, must_change_password) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [id, parsed.data.name, email, await hashPassword(parsed.data.password), parsed.data.role, parsed.data.active ?? true, parsed.data.mustChangePassword],
      );
    } catch (err) {
      if (isUniqueViolation(err)) return reply.code(409).send({ error: "já existe um utilizador com este email" });
      throw err;
    }
    await audit(db, req.actor!.id, "user.create", "user", id, req.ip, { email, role: parsed.data.role });
    return { user: await loadUser(db, id) };
  });

  app.patch("/v1/users/:id", async (req, reply) => {
    if (!requireAdmin(req, reply, requireAuth)) return;
    const id = (req.params as { id: string }).id;
    const parsed = patchSchema.safeParse(req.body);
    if (!parsed.success || !id) return reply.code(400).send({ error: "pedido inválido" });
    const current = await db.query<{ id: string; role: StaffRole; active: boolean }>(
      "SELECT id, role, active FROM users WHERE id = $1",
      [id],
    );
    const row = current.rows[0];
    if (!row) return reply.code(404).send({ error: "utilizador não encontrado" });

    const nextRole = parsed.data.role ?? row.role;
    const nextActive = parsed.data.active ?? row.active;
    const losingAdmin = row.role === "admin" && row.active && (nextRole !== "admin" || !nextActive);
    if (losingAdmin && (await adminCount(db, id)) < 1) {
      return reply.code(409).send({ error: "tem de ficar pelo menos um administrador activo" });
    }
    if (id === req.actor!.id && nextActive === false) {
      return reply.code(400).send({ error: "não pode desactivar a sua própria conta" });
    }

    let email: string | undefined;
    if (parsed.data.email !== undefined) {
      email = normalizeEmail(parsed.data.email);
      if (!isEmail(email)) return reply.code(400).send({ error: "email inválido" });
    }

    try {
      await db.query(
        `UPDATE users SET
           name = COALESCE($2, name),
           email = COALESCE($3, email),
           role = COALESCE($4, role),
           active = COALESCE($5, active)
         WHERE id = $1`,
        [id, parsed.data.name ?? null, email ?? null, parsed.data.role ?? null, parsed.data.active ?? null],
      );
    } catch (err) {
      if (isUniqueViolation(err)) return reply.code(409).send({ error: "já existe um utilizador com este email" });
      throw err;
    }

    if (nextActive === false) {
      await db.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    }
    await audit(db, req.actor!.id, "user.update", "user", id, req.ip, { role: nextRole, active: nextActive });
    return { user: await loadUser(db, id) };
  });

  app.post("/v1/users/:id/password", {
    config: { rateLimit: { max: 12, timeWindow: "1 minute" } },
  }, async (req, reply) => {
    if (!requireAdmin(req, reply, requireAuth)) return;
    const id = (req.params as { id: string }).id;
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success || !id) return reply.code(400).send({ error: "pedido inválido" });
    if (!palavraPasseValida(parsed.data.password)) {
      return reply.code(400).send({ error: mensagemPalavraPasse(parsed.data.password) });
    }
    const exists = await db.query<{ id: string }>("SELECT id FROM users WHERE id = $1", [id]);
    if (!exists.rows[0]) return reply.code(404).send({ error: "utilizador não encontrado" });
    await db.query("UPDATE users SET password_hash = $2 WHERE id = $1", [id, await hashPassword(parsed.data.password)]);
    if (parsed.data.revokeSessions) {
      await db.query("DELETE FROM sessions WHERE user_id = $1", [id]);
    }
    await audit(db, req.actor!.id, "user.password", "user", id, req.ip, { revokeSessions: Boolean(parsed.data.revokeSessions) });
    return { ok: true };
  });

  app.delete("/v1/users/:id", async (req, reply) => {
    if (!requireAdmin(req, reply, requireAuth)) return;
    const id = (req.params as { id: string }).id;
    if (!id) return reply.code(400).send({ error: "pedido inválido" });
    if (id === req.actor!.id) return reply.code(400).send({ error: "não pode eliminar a sua própria conta" });
    const current = await db.query<{ role: StaffRole; active: boolean }>("SELECT role, active FROM users WHERE id = $1", [id]);
    const row = current.rows[0];
    if (!row) return reply.code(404).send({ error: "utilizador não encontrado" });
    if (row.role === "admin" && row.active && (await adminCount(db, id)) < 1) {
      return reply.code(409).send({ error: "tem de ficar pelo menos um administrador activo" });
    }
    await db.query("DELETE FROM users WHERE id = $1", [id]);
    await audit(db, req.actor!.id, "user.delete", "user", id, req.ip);
    return { ok: true };
  });
}
