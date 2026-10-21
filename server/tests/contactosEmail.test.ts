// {{telefones_itens}} dos emails: vem dos contactos de cada local (Edição de Cursos › Locais), lidos no momento.
import { describe, expect, it } from "vitest";
import { arrancar } from "./helpers.js";

describe("contactos dos locais nos emails", () => {
  it("todos os locais com contactos, o da pré-inscrição primeiro; mudar o contacto muda o email", async () => {
    const ctx = await arrancar();
    const { telefonesPorZona } = await import("../src/automations.js");
    await ctx.db.query("DELETE FROM catalog_items WHERE kind = 'locais'");
    const local = async (id: number, regime: string, payload: Record<string, unknown>) =>
      ctx.db.query("INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1, 'locais', $2, $3::jsonb)", [id, regime, payload]);
    await local(990901, "gold", { nome: "Braga", telemovel: "912 000 001", telefone: "253 000 001", status: "Ativo" });
    await local(990902, "gold", { nome: "Porto", telemovel: "912 000 002", status: "Ativo" });
    await local(990903, "fin", { nome: "Aveiro", telemovel: "912 000 003", email: "aveiro@ena.pt", status: "Ativo" });
    await local(990904, "gold", { nome: "Lisboa", status: "Ativo" });

    const braga = "Braga: 912 000 001 · 253 000 001", porto = "Porto: 912 000 002", aveiro = "Aveiro: 912 000 003 · aveiro@ena.pt";
    // Todos os locais com contactos (Gold e Financiada); o da pessoa primeiro.
    expect(await telefonesPorZona(ctx.db)).toEqual([braga, porto, aveiro]);
    expect(await telefonesPorZona(ctx.db, { regime: "fin", local: "aveiro" })).toEqual([aveiro, braga, porto]);

    const lead = (await ctx.db.query<{ id: number }>(
      `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, estado, regime, local)
       VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Ana', 'ana.contactos@exemplo.pt', 'Curso', 'Não contactado', 'gold', 'Porto')
       RETURNING id`)).rows[0]!.id;
    expect(await telefonesPorZona(ctx.db, { preinscricaoId: lead })).toEqual([porto, braga, aveiro]);

    await ctx.db.query("UPDATE catalog_items SET payload = payload || '{\"telemovel\": \"933 333 333\"}'::jsonb WHERE id = 990902");
    expect((await telefonesPorZona(ctx.db, { preinscricaoId: lead }))[0]).toBe("Porto: 933 333 333");
  });
});
