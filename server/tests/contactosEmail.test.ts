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

    const braga = "Braga: (Telemóvel) 912 000 001 · (Telefone) 253 000 001", porto = "Porto: (Telemóvel) 912 000 002";
    const aveiro = "Aveiro: (Telemóvel) 912 000 003 · (Email) aveiro@ena.pt";
    // Todos os locais com contactos (Gold e Financiada); o da pessoa primeiro.
    expect(await telefonesPorZona(ctx.db)).toEqual([braga, porto, aveiro]);
    expect(await telefonesPorZona(ctx.db, { regime: "fin", local: "aveiro" })).toEqual([aveiro, braga, porto]);

    const lead = (await ctx.db.query<{ id: number }>(
      `INSERT INTO preinscricoes (id, inscrito, nome, email, curso, estado, regime, local)
       VALUES (nextval('ops_id_seq')::int, to_char(now(), 'YYYY-MM-DD'), 'Ana', 'ana.contactos@exemplo.pt', 'Curso', 'Não contactado', 'gold', 'Porto')
       RETURNING id`)).rows[0]!.id;
    expect(await telefonesPorZona(ctx.db, { preinscricaoId: lead })).toEqual([porto, braga, aveiro]);

    await ctx.db.query("UPDATE catalog_items SET payload = payload || '{\"telemovel\": \"933 333 333\"}'::jsonb WHERE id = 990902");
    expect((await telefonesPorZona(ctx.db, { preinscricaoId: lead }))[0]).toBe("Porto: (Telemóvel) 933 333 333");
  });

  it("no email cada local fica num bloco: nome em destaque e um contacto por linha, com espaço entre locais", async () => {
    const { renderAutomaticEmail } = await import("../src/emailHtml.js");
    const vars = { telefones_itens: "Penafiel: (Telemóvel) 917565561 · (Telefone) 223781105 · (Email) ccppenafiel@ena.pt\nBraga: (Telemóvel) 912000001" };
    const mail = renderAutomaticEmail({ nome: "Ana", xml: "<email><p>Ligue para:<br>{{telefones_itens}}</p></email>", linhas: [], cta: "", href: "", vars, origin: "https://exemplo.pt" });
    expect(mail.html).toContain("<strong>Penafiel</strong><br>Telemóvel: 917565561<br>Telefone: 223781105<br>Email: ccppenafiel@ena.pt<br><br><strong>Braga</strong><br>Telemóvel: 912000001");
    expect(mail.text).toContain("Penafiel\nTelemóvel: 917565561\nTelefone: 223781105\nEmail: ccppenafiel@ena.pt\n\nBraga\nTelemóvel: 912000001");
  });
});
