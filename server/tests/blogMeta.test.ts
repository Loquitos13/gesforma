import { describe, expect, it } from "vitest";
import { gravarDocumento, lerDocumento } from "../../src/partilhado/blogBlocos.js";
import { arrancar, pedido } from "./helpers.js";

describe("Página do artigo (imagem de destaque, excerto, curso relacionado)", () => {
  it("o documento guarda os dados da página, sem imagens inseguras, e omite-os quando estão vazios", () => {
    const corpo = JSON.stringify({ v: 1, blocos: [], meta: { capa: "/api/v1/public/imagens/x", capaAlt: "Sala", capaLegenda: "Turma", excerto: "Resumo.", curso: "formacao-de-formadores-ccp" } });
    expect(lerDocumento(corpo).meta).toEqual({ capa: "/api/v1/public/imagens/x", capaAlt: "Sala", capaLegenda: "Turma", excerto: "Resumo.", curso: "formacao-de-formadores-ccp" });
    expect(lerDocumento(JSON.stringify({ v: 1, blocos: [], meta: { capa: "javascript:alert(1)" } })).meta?.capa).toBe("");
    expect(lerDocumento(JSON.stringify({ v: 1, blocos: [], meta: { capa: "//outro.site/x.png" } })).meta?.capa).toBe("");
    expect(gravarDocumento({ v: 1, blocos: [], meta: { capa: "", capaAlt: "", capaLegenda: "", excerto: "", curso: "" } })).toBe('{"v":1,"blocos":[]}');
  });

  it("a Google recebe o excerto da notícia como descrição", async () => {
    const ctx = await arrancar();
    const { definirModeloHtml } = await import("../src/seo.js");
    definirModeloHtml('<!doctype html><html><head><title>x</title></head><body><div id="root"></div></body></html>');
    await pedido(ctx, "admin", "PUT", "/v1/settings/seo", { values: { indexar: "1", url: "https://ena.pt" } });
    const corpo = JSON.stringify({ v: 1, blocos: [{ id: "p1", tipo: "paragrafo", texto: "Texto longo do artigo." }], meta: { excerto: "Um resumo curto do artigo." } });
    const r = await pedido(ctx, "admin", "POST", "/v1/blog", { titulo: "Artigo com excerto", slug: `artigo-excerto-${Date.now()}`, data: "2026-10-18", status: "Ativo", corpo });
    expect(r.statusCode, r.body).toBe(200);
    const slug = r.json().post.slug as string;
    const html = (await ctx.app.inject({ method: "GET", url: `/v1/public/pagina?caminho=${encodeURIComponent(`/noticias/${slug}`)}`, headers: { "x-forwarded-host": "ena.pt" } })).body;
    expect(html).toContain('<meta name="description" content="Um resumo curto do artigo."');
  });
});
