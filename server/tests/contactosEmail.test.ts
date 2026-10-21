// {{telefones_itens}} dos emails: vem dos contactos de cada local (Edição de Cursos › Locais), lidos no momento.
import { describe, expect, it } from "vitest";
import { arrancar } from "./helpers.js";

describe("contactos dos locais nos emails", () => {
  it("o local da pré-inscrição primeiro; sem ele, os locais do regime; mudar o contacto muda o email", async () => {
    const ctx = await arrancar();
    const { telefonesPorZona } = await import("../src/automations.js");
    await ctx.db.query("DELETE FROM catalog_items WHERE kind = 'locais'");
    const local = async (id: number, regime: string, payload: Record<string, unknown>) =>
      ctx.db.query("INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1, 'locais', $2, $3::jsonb)", [id, regime, payload]);
    await local(990901, "gold", { nome: "Braga", telemovel: "912 000 001", telefone: "253 000 001", status: "Ativo" });
    await local(990902, "gold", { nome: "Porto", telemovel: "912 000 002", status: "Ativo" });
    await local(990903, "fin", { nome: "Aveiro", telemovel: "912 000 003", email: "aveiro@ena.pt", status: "Ativo" });
    await local(990904, "gold", { nome: "Lisboa", status: "Ativo" });

    expect(await telefonesPorZona(ctx.db, { regime: "gold", local: "braga" })).toEqual(["Braga: 912 000 001 · 253 000 001"]);
    expect(await telefonesPorZona(ctx.db, { regime: "gold" })).toEqual(["Braga: 912 000 001 · 253 000 001", "Porto: 912 000 002"]);
    expect(await telefonesPorZona(ctx.db, { regime: "fin", local: "Sem contactos" })).toEqual(["Aveiro: 912 000 003 · aveiro@ena.pt"]);

    const lead = (await ctx.db.query<{ id: number }>(
      `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, estado, regime, local)
       VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Ana', 'ana.contactos@exemplo.pt', 'Curso', 'Não contactado', 'gold', 'Porto')
       RETURNING id`)).rows[0]!.id;
    expect(await telefonesPorZona(ctx.db, { preinscricaoId: lead })).toEqual(["Porto: 912 000 002"]);

    await ctx.db.query("UPDATE catalog_items SET payload = payload || '{\"telemovel\": \"933 333 333\"}'::jsonb WHERE id = 990902");
    expect(await telefonesPorZona(ctx.db, { preinscricaoId: lead })).toEqual(["Porto: 933 333 333"]);
  });
});
