import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

describe("cursos sugeridos ao formando", () => {
  it("da área temática do curso que fez, no mesmo regime, sem o próprio curso", async () => {
    const ctx = await arrancar();
    const catalogo = (await ctx.app.inject({ method: "GET", url: "/v1/public/catalogo" })).json().cursos as { titulo: string; area: string; regime: string }[];
    const feito = catalogo.find(c => c.regime === "gold" && catalogo.some(o => o !== c && o.regime === "gold" && o.area === c.area));
    expect(feito, "o seed tem de ter dois cursos Gold da mesma área").toBeTruthy();
    await ctx.db.query(
      `INSERT INTO formandos_gold (id, nome, apelido, email, curso, estado, user_id)
       VALUES ((SELECT COALESCE(MAX(id), 0) + 1 FROM formandos_gold), 'Ana', 'Silva', 'ana.sugestoes@exemplo.pt', $1, 'Inscrito', $2)`,
      [feito!.titulo, ctx.userId.formando],
    );

    const r = await pedido(ctx, "formando", "GET", "/v1/area-formando/sugestoes");
    expect(r.statusCode, r.body).toBe(200);
    const cursos = r.json().cursos as { titulo: string; area: string }[];
    expect(cursos.length).toBeGreaterThan(0);
    expect(cursos.map(c => c.titulo)).not.toContain(feito!.titulo);
    for (const c of cursos) expect(c.area).toBe(feito!.area);
    // Só cursos Gold: o formando Gold não recebe sugestões da Financiada.
    const fin = new Set(catalogo.filter(c => c.regime === "fin").map(c => c.titulo));
    for (const c of cursos) expect(fin.has(c.titulo)).toBe(false);

    expect((await pedido(ctx, "secretaria", "GET", "/v1/area-formando/sugestoes")).statusCode).toBe(403);
  });
});
