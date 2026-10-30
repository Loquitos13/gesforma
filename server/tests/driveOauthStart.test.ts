import { beforeAll, describe, expect, it } from "vitest";
import { arrancar, pedido, type Ctx } from "./helpers.js";

describe("Drive: ligar a conta Google", () => {
  let ctx: Ctx;
  beforeAll(async () => { ctx = await arrancar(); });

  it("o início do OAuth grava o estado e reencaminha para a Google", async () => {
    expect((await pedido(ctx, "admin", "PUT", "/v1/drive/config", { clientId: "cliente.apps.googleusercontent.com", clientSecret: "segredo-de-teste-123" })).statusCode).toBe(200);
    const r = await pedido(ctx, "admin", "GET", "/v1/drive/oauth/start");
    expect(r.statusCode).toBe(302);
    expect(r.headers.location).toContain("accounts.google.com");
    const { rows } = await ctx.db.query<{ purpose: string }>("SELECT purpose FROM oauth_states");
    expect(rows.map(x => x.purpose)).toContain("drive");
  });
});
