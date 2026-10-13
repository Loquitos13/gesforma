import { describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

const NOVA = "Nova.Palavra2026!";

async function login(ctx: Ctx, email: string, password: string) {
  return ctx.app.inject({
    method: "POST", url: "/v1/auth/login",
    headers: { "x-gesforma-client": "web" },
    payload: { email, password },
  });
}

async function idDe(ctx: Ctx, email: string) {
  const r = await ctx.db.query<{ id: string }>("SELECT id FROM users WHERE email = $1", [email]);
  return r.rows[0]!.id;
}

describe("palavra-passe alterada na Utilizadores", () => {
  it("o admin das variáveis de ambiente entra com a nova, também depois de um arranque a frio", async () => {
    const ctx = await arrancar();
    const { config } = await import("../src/config.js");
    const { seed } = await import("../src/db/seed.js");
    const email = config.adminEmail;
    const id = await idDe(ctx, email);
    const r = await pedido(ctx, "admin", "POST", `/v1/users/${id}/password`, { password: NOVA, revokeSessions: true });
    expect(r.statusCode, r.body).toBe(200);
    expect((await login(ctx, email, NOVA)).statusCode).toBe(200);
    await seed(ctx.db);
    expect((await login(ctx, email, NOVA)).statusCode).toBe(200);
    expect((await login(ctx, email, config.adminPassword)).statusCode).toBe(401);
  });

  it("utilizadores de demonstração não voltam à palavra-passe antiga a cada arranque", async () => {
    const ctx = await arrancar();
    const { seed } = await import("../src/db/seed.js");
    const email = "aguiar@ena.pt";
    const id = await idDe(ctx, email);
    expect((await pedido(ctx, "admin", "POST", `/v1/users/${id}/password`, { password: NOVA })).statusCode).toBe(200);
    await seed(ctx.db);
    expect((await login(ctx, email, NOVA)).statusCode).toBe(200);
  });
});
