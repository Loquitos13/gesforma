// Financiada: a data registada em Edição de Cursos › Datas aparece no cartão do curso no catálogo (em vez de «Data a anunciar»).
import { describe, expect, it } from "vitest";
import { arrancar } from "./helpers.js";

describe("catálogo: datas da Financiada", () => {
  it("o cartão mostra a próxima data registada do curso", async () => {
    const ctx = await arrancar();
    const { listarCatalogoPublico } = await import("../src/catalogoPublico.js");
    const fin = (await listarCatalogoPublico(ctx.db)).cursos.filter(c => c.regime === "fin" && c.inicio === "Data a anunciar");
    expect(fin.length).toBeGreaterThan(0);
    const alvo = fin[0]!;
    const row = await ctx.db.query<{ nome: string }>(
      "SELECT COALESCE(NULLIF(nome_comercial, ''), ufcd) AS nome FROM cursos_fin WHERE COALESCE(NULLIF(nome_comercial, ''), ufcd) = $1 OR ufcd = $1 LIMIT 1",
      [alvo.titulo]);
    const curso = row.rows[0]?.nome ?? alvo.titulo;
    const id = async () => (await ctx.db.query<{ n: number }>("SELECT coalesce(max(id), 0) + 1 AS n FROM catalog_items")).rows[0]!.n;
    await ctx.db.query("INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1, 'datas', 'fin', $2::jsonb)",
      [await id(), JSON.stringify({ curso, inicio: "2099-03-10", local: "Online", status: "Ativo" })]);
    await ctx.db.query("INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1, 'datas', 'fin', $2::jsonb)",
      [await id(), JSON.stringify({ curso, inicio: "2099-01-15", local: "Online", status: "Ativo" })]);
    const depois = (await listarCatalogoPublico(ctx.db)).cursos.find(c => c.id === alvo.id)!;
    // A mais próxima das duas, com o local.
    expect(depois.inicio).toMatch(/^15\D01\D2099 · Online$/);
  });
});
