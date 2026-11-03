// CCP: a escolaridade decide os documentos (12.º ano → comprovativo de 5 anos de experiência; licenciatura → só habilitações).
import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

describe("documentos do CCP pela escolaridade", () => {
  it("12.º ano pede experiência; licenciatura só o certificado de habilitações; sem escolaridade fica igual", async () => {
    const ctx = await arrancar();
    const nome = `Formação de Formadores - CCP ${Date.now()}`;
    const r = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome, categoria: "CCP", tipo: "Pré-inscrição", preco: 100, regime: "B-learning", horas: 90 });
    expect(r.statusCode, r.body).toBe(200);
    const { docsDoCurso } = await import("../src/docsCurso.js");
    const ids = async (esc: string) => (await docsDoCurso(ctx.db, nome, "gold", esc)).filter(d => d.required).map(d => d.id);

    const doze = await ids("12.º ano");
    expect(doze).toContain("exp");
    expect(doze).toContain("ch");
    const lic = await ids("Licenciatura");
    expect(lic).toContain("ch");
    expect(lic).not.toContain("exp");
    expect((await docsDoCurso(ctx.db, nome, "gold", "")).map(d => d.id)).toEqual((await docsDoCurso(ctx.db, nome, "gold")).map(d => d.id));

    // Outro curso: a escolaridade não muda nada.
    const outro = `Excel ${Date.now()}`;
    await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome: outro, categoria: "T", tipo: "Pré-inscrição", preco: 50, regime: "Presencial", horas: 8 });
    expect((await docsDoCurso(ctx.db, outro, "gold", "12.º ano")).map(d => d.id)).toEqual((await docsDoCurso(ctx.db, outro, "gold")).map(d => d.id));
  });
});
