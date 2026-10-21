import { describe, expect, it } from "vitest";
import { LIMITES_SERVICO } from "../../src/partilhado/siteServicos.js";
import { arrancar, pedido } from "./helpers.js";

// O que se escreve no backoffice é o que fica gravado e o que o site recebe: só se tiram os espaços das pontas.
describe("Serviços: os textos gravam-se tal como foram escritos", () => {
  it("parágrafos, listas, tabulações, espaços seguidos, aspas e marcas chegam iguais ao backoffice e ao site", async () => {
    const ctx = await arrancar();
    const detalhe = [
      "## O que fazemos",
      "",
      "Primeiro parágrafo com **negrito**, *itálico*,\tuma tabulação e  dois espaços.",
      "Segunda linha do mesmo parágrafo — com «aspas» e “curvas”.",
      "",
      "- ponto um",
      "- ponto dois",
      "",
      "1. passo",
      "2. passo",
      "",
      "",
      "Ligação: https://ena.pt/empresas · emoji 👍 · ç ã é",
    ].join("\n");
    const texto = "Descrição curta.\n\nCom um segundo parágrafo que o topo da página também mostra.";
    const cartao = "Texto do cartão\n- com lista\n- de dois";
    const r = await pedido(ctx, "admin", "POST", "/v1/servicos", {
      slug: "", ativo: true,
      dados: { titulo: "Serviço com texto formatado", texto: `  ${texto}\n\n `, detalhe, pontos: "um\ndois", cartoes: [{ titulo: "C", texto: cartao }], ctaTexto: "Fim\n\nmesmo" },
    });
    expect(r.statusCode, r.body).toBe(200);
    const id = r.json().servico.id as number;

    const doBackoffice = ((await pedido(ctx, "admin", "GET", "/v1/servicos")).json().servicos as { id: number; dados: Record<string, unknown> }[]).find(s => s.id === id)!.dados;
    const doSite = ((await ctx.app.inject({ method: "GET", url: "/v1/public/servicos" })).json().servicos as Record<string, unknown>[]).find(s => s.slug === "servico-com-texto-formatado")!;
    for (const d of [doBackoffice, doSite, r.json().servico.dados as Record<string, unknown>]) {
      expect(d.detalhe).toBe(detalhe);
      expect(d.texto).toBe(texto); // só as pontas
      expect(d.pontos).toBe("um\ndois");
      expect(d.ctaTexto).toBe("Fim\n\nmesmo");
      expect((d.cartoes as { texto: string }[])[0]!.texto).toBe(cartao);
    }

    // Gravar outra vez o que veio do backoffice não muda nada (o formulário reenvia os dados tal como os leu).
    const de_novo = await pedido(ctx, "admin", "PUT", `/v1/servicos/${id}`, { slug: "servico-com-texto-formatado", ativo: true, dados: doBackoffice });
    expect(de_novo.statusCode, de_novo.body).toBe(200);
    expect(de_novo.json().servico.dados).toEqual(doBackoffice);
  });

  it("os limites são os do backoffice: o texto no limite grava-se inteiro, um a mais é recusado (nunca cortado em silêncio)", async () => {
    const ctx = await arrancar();
    const cheio = "a".repeat(LIMITES_SERVICO.cartaoTexto);
    const ok = await pedido(ctx, "admin", "POST", "/v1/servicos", { slug: "", ativo: true, dados: { titulo: "Cartões compridos", cartoes: [{ titulo: "C", texto: cheio }], detalhe: "d".repeat(LIMITES_SERVICO.detalhe) } });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().servico.dados.cartoes[0].texto).toHaveLength(LIMITES_SERVICO.cartaoTexto);
    expect(ok.json().servico.dados.detalhe).toHaveLength(LIMITES_SERVICO.detalhe);
    const demais = await pedido(ctx, "admin", "POST", "/v1/servicos", { slug: "", ativo: true, dados: { titulo: "Cartões demais", cartoes: [{ titulo: "C", texto: `${cheio}a` }] } });
    expect(demais.statusCode).toBe(400);
    expect((await pedido(ctx, "admin", "POST", "/v1/servicos", { slug: "", ativo: true, dados: { titulo: "Texto demais", texto: "x".repeat(LIMITES_SERVICO.texto + 1) } })).statusCode).toBe(400);
  });

  it("a página do serviço no SEO usa o texto sem as marcas", async () => {
    const ctx = await arrancar();
    const { definirModeloHtml } = await import("../src/seo.js");
    definirModeloHtml('<!doctype html><html lang="pt"><head><meta charset="UTF-8" /><title>GesForma</title></head><body><div id="root"></div></body></html>');
    const r = await pedido(ctx, "admin", "POST", "/v1/servicos", { slug: "seo-formatado", ativo: true, dados: { titulo: "SEO formatado", detalhe: "## Sobre\n\n**Formação** à *medida*:\n- um\n- dois" } });
    expect(r.statusCode, r.body).toBe(200);
    const html = (await ctx.app.inject({ method: "GET", url: `/v1/public/pagina?caminho=${encodeURIComponent("/empresas/seo-formatado")}`, headers: { "x-forwarded-host": "ena.pt" } })).body;
    expect(html).toContain("Sobre Formação à medida: um; dois");
    expect(html).not.toContain("**Formação**");
  });
});
