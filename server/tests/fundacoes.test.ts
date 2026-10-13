import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

describe("fundações", () => {
  it("db.tx confirma tudo ou nada", async () => {
    const { db } = await arrancar();
    await db.query("CREATE TABLE IF NOT EXISTS t_tx (n int)");
    await expect(db.tx(async q => {
      await q("INSERT INTO t_tx (n) VALUES (1)");
      throw new Error("falha");
    })).rejects.toThrow("falha");
    expect((await db.query("SELECT count(*)::int AS c FROM t_tx")).rows[0]!.c).toBe(0);
    await db.tx(async q => {
      await q("INSERT INTO t_tx (n) VALUES (1)");
      await q("INSERT INTO t_tx (n) VALUES (2)");
    });
    expect((await db.query("SELECT count(*)::int AS c FROM t_tx")).rows[0]!.c).toBe(2);
  });

  it("sessão de teste abre /v1/me", async () => {
    const ctx = await arrancar();
    const res = await pedido(ctx, "secretaria", "GET", "/v1/me");
    expect(res.statusCode).toBe(200);
  });
});
