// Migração 224: o pop-up do WhatsApp do site usa o contacto geral; os contactos de cada local ficam como estão.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { arrancar } from "./helpers.js";

describe("WhatsApp geral", () => {
  it("o assistente fica com o número geral; o WhatsApp de cada local e das fichas não muda", async () => {
    const ctx = await arrancar();
    const id = 990000 + Math.floor(Math.random() * 9000);
    const local = { nome: "Penafiel Teste", telemovel: "917565561", whatsapp: "917565561" };
    await ctx.db.query("INSERT INTO catalog_items (id, kind, regime, payload) VALUES ($1, 'locais', 'gold', $2::jsonb)", [id, JSON.stringify(local)]);
    await ctx.db.query(
      `INSERT INTO app_settings (id, values) VALUES ('site', '{"evaNome": "Eva"}'::jsonb)
       ON CONFLICT (id) DO UPDATE SET values = app_settings.values || '{"evaNome": "Eva"}'::jsonb`);
    const ficha = { contactosLocais: { "Penafiel Teste": { telemovel: "917565561", whatsapp: "917565561" } } };
    await ctx.db.query(
      `INSERT INTO curso_fichas (regime, curso_id, payload) VALUES ('gold', $1, $2::jsonb)
       ON CONFLICT (regime, curso_id) DO UPDATE SET payload = EXCLUDED.payload`, [id, JSON.stringify(ficha)]);

    // Corre outra vez as instruções da migração, agora com dados (a base de testes já a tinha corrido vazia).
    const sql = readFileSync(new URL("../src/db/migrations/224_whatsapp_geral.sql", import.meta.url), "utf8");
    for (const s of sql.split(/;\s*\n/).map(x => x.trim()).filter(Boolean)) await ctx.db.query(s);

    const site = (await ctx.db.query<{ values: Record<string, string> }>("SELECT values FROM app_settings WHERE id = 'site'")).rows[0]!.values;
    expect(site).toMatchObject({ evaNome: "Eva", evaWhatsapp: "351962215550" });
    const guardado = (await ctx.db.query<{ payload: Record<string, string> }>("SELECT payload FROM catalog_items WHERE kind = 'locais' AND id = $1", [id])).rows[0]!.payload;
    expect(guardado).toEqual(local);
    const daFicha = (await ctx.db.query<{ payload: unknown }>("SELECT payload FROM curso_fichas WHERE regime = 'gold' AND curso_id = $1", [id])).rows[0]!.payload;
    expect(daFicha).toEqual(ficha);
  });
});
