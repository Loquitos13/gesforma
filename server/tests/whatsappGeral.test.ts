// Migração 224: um só WhatsApp (o geral da ENA) no assistente do site e em todos os locais.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { arrancar } from "./helpers.js";

describe("WhatsApp geral", () => {
  it("todos os locais e o assistente ficam com o número geral; a ficha do curso deixa de ter WhatsApp próprio", async () => {
    const ctx = await arrancar();
    const id = 990000 + Math.floor(Math.random() * 9000);
    await ctx.db.query("INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1, 'locais', 'gold', $2::jsonb)",
      [id, JSON.stringify({ nome: "Penafiel Teste", telemovel: "917565561", whatsapp: "917565561" })]);
    await ctx.db.query("INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1, 'locais', 'gold', $2::jsonb)",
      [id + 1, JSON.stringify({ nome: "Sem Contactos Teste", morada: "Rua X" })]);
    await ctx.db.query(
      `INSERT INTO app_settings (id, values) VALUES ('site', '{"evaNome": "Eva"}'::jsonb)
       ON CONFLICT (id) DO UPDATE SET values = app_settings.values || '{"evaNome": "Eva"}'::jsonb`);
    await ctx.db.query(
      `INSERT INTO curso_fichas (regime, curso_id, payload) VALUES ('gold', $1, $2::jsonb)
       ON CONFLICT (regime, curso_id) DO UPDATE SET payload = EXCLUDED.payload`,
      [id, JSON.stringify({ contactosLocais: { "Penafiel Teste": { telemovel: "917565561", whatsapp: "917565561" } } })]);

    // Corre outra vez as instruções da migração, agora com dados (a base de testes já a tinha corrido vazia).
    const sql = readFileSync(new URL("../src/db/migrations/224_whatsapp_geral.sql", import.meta.url), "utf8");
    for (const s of sql.split(/;\s*\n/).map(x => x.trim()).filter(Boolean)) await ctx.db.query(s);

    const local = (await ctx.db.query<{ payload: Record<string, string> }>("SELECT payload FROM catalog_items WHERE kind = 'locais' AND id = $1", [id])).rows[0]!.payload;
    expect(local).toMatchObject({ nome: "Penafiel Teste", telemovel: "917565561", whatsapp: "962215550" });
    // Um local sem contactos continua sem eles (não passa a aparecer nos telefones por zona dos emails).
    const semContactos = (await ctx.db.query<{ payload: Record<string, string> }>("SELECT payload FROM catalog_items WHERE kind = 'locais' AND id = $1", [id + 1])).rows[0]!.payload;
    expect(semContactos.whatsapp).toBeUndefined();
    const site = (await ctx.db.query<{ values: Record<string, string> }>("SELECT values FROM app_settings WHERE id = 'site'")).rows[0]!.values;
    expect(site).toMatchObject({ evaNome: "Eva", evaWhatsapp: "351962215550" });
    const ficha = (await ctx.db.query<{ payload: { contactosLocais: Record<string, Record<string, string>> } }>(
      "SELECT payload FROM curso_fichas WHERE regime = 'gold' AND curso_id = $1", [id])).rows[0]!.payload;
    expect(ficha.contactosLocais["Penafiel Teste"]).toEqual({ telemovel: "917565561" });
  });
});
