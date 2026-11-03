// Migração 232: o contrato e o regulamento / declaração RGPD ficam desligados em todos os cursos (sem perder os outros ocultos).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { arrancar } from "./helpers.js";

describe("documentos de teste desligados nos cursos", () => {
  it("junta contrato e regulamento (Gold) / contrato e RGPD (Financiada) aos ocultos, também sem configuração", async () => {
    const ctx = await arrancar();
    await ctx.db.query("INSERT INTO cursos_gold (id, nome, docs_preinscricao) VALUES (990001, 'Curso A', $1::jsonb), (990002, 'Curso B', NULL)",
      [JSON.stringify({ ocultos: ["pip"], extra: [{ id: "x", label: "X", required: false }] })]);
    await ctx.db.query("INSERT INTO cursos_fin (id, ufcd, docs_preinscricao) VALUES (990003, 'UFCD Z', NULL)");
    const sql = readFileSync(join(process.cwd(), "src/db/migrations/232_docs_contrato_rgpd_desligados.sql"), "utf8");
    for (const parte of sql.split(/;\s*\n/).map(s => s.trim()).filter(s => s && !/^(--[^\n]*\n?)+$/.test(s))) await ctx.db.query(parte);
    const ocultos = async (t: string, id: number) =>
      ((await ctx.db.query<{ c: { ocultos: string[]; extra?: unknown[] } }>(`SELECT docs_preinscricao AS c FROM ${t} WHERE id = $1`, [id])).rows[0]!.c);
    const a = await ocultos("cursos_gold", 990001);
    expect([...a.ocultos].sort()).toEqual(["contrato", "pip", "regulamento"]);
    expect(a.extra).toHaveLength(1);
    expect([...(await ocultos("cursos_gold", 990002)).ocultos].sort()).toEqual(["contrato", "regulamento"]);
    expect([...(await ocultos("cursos_fin", 990003)).ocultos].sort()).toEqual(["contrato", "rgpd"]);
  });
});
