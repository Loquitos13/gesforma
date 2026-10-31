import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { arrancar } from "./helpers.js";

describe("Migração 213: cartão «Formação Financiada» do topo da página inicial", () => {
  it("troca a etiqueta, a imagem, o botão e junta os logótipos; o resto da página fica", async () => {
    const ctx = await arrancar();
    const cartao = { texto: "", imagem: "/api/v1/public/imagens/4Dgm_L7Chyj1WvBvtfTZgCkM", titulo: "Formação Financiada", cursoId: "", ligacao: "/formacao?linha=financiada", etiqueta: "6€ por dia", animacaoBotao: "nenhuma" };
    const pagina = { content: [{ type: "CursosDestaque", props: { id: "x", cursos: [{ cursoId: "formacao-de-formadores-ccp" }, cartao], __disp: { base: { cursos: [cartao] } } } }], root: { props: {} } };
    await ctx.db.query(`INSERT INTO site_paginas (pagina, rascunho, publicado) VALUES ('inicio', $1::jsonb, $1::jsonb)
      ON CONFLICT (pagina) DO UPDATE SET rascunho = EXCLUDED.rascunho, publicado = EXCLUDED.publicado`, [JSON.stringify(pagina)]);
    const sql = readFileSync(new URL("../src/db/migrations/213_cartao_financiada_hero.sql", import.meta.url), "utf8");
    await ctx.db.query(sql);
    const { rows } = await ctx.db.query<{ publicado: typeof pagina; rascunho: typeof pagina }>("SELECT publicado, rascunho FROM site_paginas WHERE pagina = 'inicio'");
    for (const p of [rows[0]!.publicado, rows[0]!.rascunho]) {
      const props = p.content[0]!.props as unknown as { cursos: Record<string, string>[]; __disp: { base: { cursos: Record<string, string>[] } } };
      for (const c of [props.cursos[1]!, props.__disp.base.cursos[0]!]) {
        expect(c).toMatchObject({
          etiqueta: "Financiada", etiqueta2: "Subsídio de 6€ por dia", botao: "Cursos",
          imagem: "/imagens/financiada-capa.jpg", imagemRodape: "/imagens/logos-financiamento.png", ligacao: "/formacao?linha=financiada",
        });
      }
      expect(props.cursos[0]).toEqual({ cursoId: "formacao-de-formadores-ccp" });
    }
  });
});
