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
    const base = await docsDoCurso(ctx.db, nome, "gold");
    const doze = await docsDoCurso(ctx.db, nome, "gold", "12.º ano");
    const lic = await docsDoCurso(ctx.db, nome, "gold", "Licenciatura");

    // 12.º ano: o comprovativo de experiência passa a obrigatório; nada mais muda (nem se repete documento nenhum).
    expect(doze.map(d => d.id)).toEqual(base.map(d => d.id));
    expect(doze.find(d => /experi/i.test(d.label))?.required).toBe(true);
    expect(new Set(doze.map(d => d.label)).size).toBe(doze.length);
    // Licenciatura: não se pede a experiência; o resto fica igual.
    expect(lic.some(d => /experi/i.test(d.label))).toBe(false);
    expect(lic.map(d => d.id)).toEqual(base.filter(d => !/experi/i.test(d.label)).map(d => d.id));
    expect((await docsDoCurso(ctx.db, nome, "gold", "")).map(d => d.id)).toEqual(base.map(d => d.id));

    // Como na ficha real: a experiência escondida e o certificado de habilitações como documento extra da ficha.
    // Com o 12.º ano acrescenta-se só o comprovativo de experiência; o certificado não se repete.
    const { gravarDocsPreinscricao } = await import("../src/docsCurso.js");
    const cursoId = (await ctx.db.query<{ id: number }>("SELECT id FROM cursos_gold WHERE nome = $1", [nome])).rows[0]!.id;
    await gravarDocsPreinscricao(ctx.db, "gold", cursoId, {
      ocultos: ["contrato", "regulamento", "pip", "exp"],
      extra: [{ id: "curriculo", label: "Currículo", required: true }, { id: "cert-hab", label: "Certificado de habilitações", required: true }],
    });
    const ficha = async (esc: string) => (await docsDoCurso(ctx.db, nome, "gold", esc)).filter(d => d.id !== "comprovativo").map(d => `${d.id}:${d.required ? 1 : 0}`);
    expect(await ficha("12.º ano")).toEqual(["cc:1", "curriculo:1", "cert-hab:1", "exp:1"]);
    expect(await ficha("Licenciatura")).toEqual(["cc:1", "curriculo:1", "cert-hab:1"]);
    expect(await ficha("")).toEqual(["cc:1", "curriculo:1", "cert-hab:1"]);

    // Outro curso: a escolaridade não muda nada.
    const outro = `Excel ${Date.now()}`;
    await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", { nome: outro, categoria: "T", tipo: "Pré-inscrição", preco: 50, regime: "Presencial", horas: 8 });
    expect((await docsDoCurso(ctx.db, outro, "gold", "12.º ano")).map(d => d.id)).toEqual((await docsDoCurso(ctx.db, outro, "gold")).map(d => d.id));
  });
});
