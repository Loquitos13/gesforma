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

  it("no email os contactos vão para o fim, depois do botão, num quadro de 2 colunas", async () => {
    const { renderAutomaticEmail } = await import("../src/emailHtml.js");
    const vars = { documentos_url: "https://exemplo.pt/d", telefones_itens: "Penafiel: (Telemóvel) 917565561 · (Telefone) 223781105 · (Email) ccppenafiel@ena.pt\nBraga: (Telemóvel) 912000001\nAveiro: (Telemóvel) 912000003" };
    const xml = "<email><p>Ligue para:<br>{{telefones_itens}}</p><p>Envie os documentos.</p></email>";
    const mail = renderAutomaticEmail({ nome: "Ana", xml, linhas: [], cta: "Submeter", href: "https://exemplo.pt/d", vars, origin: "https://exemplo.pt" });
    const html = mail.html;
    expect(html.indexOf("Envie os documentos.")).toBeLessThan(html.indexOf("Submeter"));
    expect(html.indexOf("Submeter")).toBeLessThan(html.indexOf("Ligue para:"));
    expect(html).toContain('<strong style="color:#0f172a;">Penafiel</strong><br>Telemóvel: 917565561<br>Telefone: 223781105<br>Email: ccppenafiel@ena.pt</td>');
    // Duas colunas: Penafiel e Braga na mesma linha, Aveiro na seguinte.
    expect(html).toMatch(/<tr><td[^>]*>.*Penafiel.*<\/td><td[^>]*>.*Braga.*<\/td><\/tr><tr><td[^>]*>.*Aveiro/);
    expect(mail.text.indexOf("Submeter")).toBeLessThan(mail.text.indexOf("Ligue para:"));
    expect(mail.text).toContain("Ligue para:\n\nPenafiel\nTelemóvel: 917565561\nTelefone: 223781105\nEmail: ccppenafiel@ena.pt\n\nBraga");
  });
});
