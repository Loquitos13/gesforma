import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

// Turmas antigas guardaram listas jsonb como texto ("[...]") ou como null JSON: a lista e a ficha não podem rebentar.
describe("formadores com jsonb legado nas turmas", () => {
  it("lista e ficha da Financiada respondem 200", async () => {
    const ctx = await arrancar();
    const nome = `Formador Legado ${Date.now()}`;
    const criado = await pedido(ctx, "secretaria", "POST", "/v1/formadores", { nome, regimes: ["gold", "fin"] });
    expect(criado.statusCode, criado.body).toBe(200);
    const id = (criado.json() as { formador: { id: number } }).formador.id;

    const t = await pedido(ctx, "financiada", "POST", "/v1/turmas-fin", { dataInicio: "2020-01-06", nome: `TL ${Date.now()}`, curso: "Curso Legado", formador: nome });
    expect(t.statusCode, t.body).toBe(200);
    const turmaId = (t.json() as { turma?: { id: number }; id?: number }).turma?.id ?? (t.json() as { id: number }).id;
    await ctx.db.query(`UPDATE turmas_fin SET formadores = to_jsonb($2::text), valores_hora_formador = to_jsonb($3::text) WHERE id = $1`,
      [turmaId, JSON.stringify([nome]), JSON.stringify({ [nome]: 30 })]);
    await ctx.db.query(`UPDATE turmas_gold SET formadores = 'null'::jsonb WHERE id = (SELECT min(id) FROM turmas_gold)`);

    for (const regime of ["fin", "gold"]) {
      const r = await pedido(ctx, "secretaria", "GET", `/v1/formadores?regime=${regime}`);
      expect(r.statusCode, `${regime}: ${r.body}`).toBe(200);
    }
    const ficha = await pedido(ctx, "secretaria", "GET", `/v1/formadores/${id}`);
    expect(ficha.statusCode, ficha.body).toBe(200);
    expect((ficha.json() as { turmas: { id: number; valorHora: number }[] }).turmas.find(x => x.id === turmaId)?.valorHora).toBe(0);

    // A migração 112 desembrulha os valores gravados como texto.
    const sql = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/db/migrations/112_jsonb_legado_formadores.sql"), "utf8");
    await ctx.db.tx(async q => { for (const p of sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean)) await q(p); });
    const r = await ctx.db.query<{ f: string; v: string }>(
      "SELECT jsonb_typeof(formadores) AS f, jsonb_typeof(valores_hora_formador) AS v FROM turmas_fin WHERE id = $1", [turmaId]);
    expect(r.rows[0]).toEqual({ f: "array", v: "object" });
    const depois = await pedido(ctx, "secretaria", "GET", `/v1/formadores/${id}`);
    expect((depois.json() as { turmas: { id: number; valorHora: number }[] }).turmas.find(x => x.id === turmaId)?.valorHora).toBe(30);
  });
});
