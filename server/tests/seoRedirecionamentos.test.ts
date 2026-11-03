// Endereços do site antigo → site novo (301), sem tocar nos endereços do site novo.
import { describe, expect, it } from "vitest";
import { arrancar } from "./helpers.js";

describe("redirecionamentos do site antigo", () => {
  it("blog, curso antigo, sobre nós e endereços legais; o site novo fica igual", async () => {
    const ctx = await arrancar();
    const ir = async (caminho: string) => {
      const r = await ctx.app.inject({ method: "GET", url: `/v1/public/pagina?caminho=${encodeURIComponent(caminho)}` });
      return { estado: r.statusCode, para: String(r.headers.location ?? "") };
    };
    expect(await ir("/blog")).toEqual({ estado: 301, para: "/noticias" });
    expect(await ir("/blog/artigo-que-nao-existe")).toEqual({ estado: 301, para: "/noticias" });
    expect(await ir("/sobre-nos")).toEqual({ estado: 301, para: "/#onde-estamos" });
    expect((await ir("/formacao/curso/nada-parecido-xyz")).para).toBe("/formacao");
    expect(await ir("/politica-de-privacidade")).toEqual({ estado: 302, para: "https://antigo.ena.pt/politica-de-privacidade" });
    for (const c of ["/", "/formacao", "/noticias", "/area-formando", "/pre-inscricao", "/empresas"]) {
      expect((await ir(c)).estado, c).not.toBe(301);
    }
  });
});
