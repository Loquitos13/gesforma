import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

const opiniao = (extra: Record<string, unknown> = {}) => ({
  nome: "Ana S.", curso: "Formação de Formadores - CCP", texto: "Formadores excelentes e muito práticos.", estrelas: 5, autorizaPublicar: true, ...extra,
});
const publicos = async (ctx: Awaited<ReturnType<typeof arrancar>>) =>
  (await ctx.app.inject({ method: "GET", url: "/v1/public/testemunhos" })).json().testemunhos as { nome: string; texto: string }[];

describe("testemunhos dos formandos", () => {
  it("o formando deixa a opinião; só aparece no site depois de aprovada pela administração", async () => {
    const ctx = await arrancar();
    expect((await pedido(ctx, "secretaria", "PUT", "/v1/area-formando/testemunho", opiniao())).statusCode).not.toBe(200);
    expect((await pedido(ctx, "formando", "PUT", "/v1/area-formando/testemunho", opiniao({ texto: "curto" }))).statusCode).toBe(400);

    const g = await pedido(ctx, "formando", "PUT", "/v1/area-formando/testemunho", opiniao());
    expect(g.statusCode, g.body).toBe(200);
    expect(g.json().testemunho).toMatchObject({ nome: "Ana S.", estado: "pendente", estrelas: 5 });
    expect(await publicos(ctx)).toEqual([]);

    // Só o admin revê (a secretaria e o comercial não).
    expect((await pedido(ctx, "secretaria", "GET", "/v1/testemunhos")).statusCode).toBe(403);
    const lista = (await pedido(ctx, "admin", "GET", "/v1/testemunhos?estado=pendente")).json().testemunhos;
    expect(lista).toHaveLength(1);
    const id = lista[0].id as number;
    expect((await pedido(ctx, "comercial", "PATCH", `/v1/testemunhos/${id}`, { estado: "aprovado" })).statusCode).toBe(403);
    expect((await pedido(ctx, "admin", "PATCH", `/v1/testemunhos/${id}`, { estado: "aprovado" })).statusCode).toBe(200);

    const site = await publicos(ctx);
    expect(site).toEqual([{ nome: "Ana S.", curso: "Formação de Formadores - CCP", texto: "Formadores excelentes e muito práticos.", estrelas: 5 }]);

    // Editar volta a pôr em revisão (sai do site até ser aprovado de novo).
    await pedido(ctx, "formando", "PUT", "/v1/area-formando/testemunho", opiniao({ texto: "Mudei de opinião, ainda melhor do que pensava." }));
    expect(await publicos(ctx)).toEqual([]);
    expect((await pedido(ctx, "formando", "GET", "/v1/area-formando/testemunho")).json().testemunho.estado).toBe("pendente");
  });

  it("sem autorização para publicar, mesmo aprovado não vai para o site; apagar a conta apaga o testemunho", async () => {
    const ctx = await arrancar();
    const t = (await pedido(ctx, "formando", "PUT", "/v1/area-formando/testemunho", opiniao({ autorizaPublicar: false }))).json().testemunho;
    await pedido(ctx, "admin", "PATCH", `/v1/testemunhos/${t.id}`, { estado: "aprovado" });
    expect(await publicos(ctx)).toEqual([]);

    await ctx.db.query("DELETE FROM users WHERE id = $1", [ctx.userId.formando]);
    expect((await ctx.db.query("SELECT 1 FROM testemunhos WHERE id = $1", [t.id])).rows).toHaveLength(0);
  });
});
