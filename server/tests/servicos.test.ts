import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

describe("Serviços para empresas (Gestão › Empresas / Business)", () => {
  it("só a administração escreve; o site vê os ativos pela ordem; endereço único e conteúdo validado", async () => {
    const ctx = await arrancar();
    const publicos = async () => (await ctx.app.inject({ method: "GET", url: "/v1/public/servicos" })).json().servicos as { slug: string; titulo: string }[];
    // Começa com os serviços que o site já mostrava.
    expect((await publicos()).map(s => s.slug)).toEqual([
      "formacao-a-medida", "formacao-certificada", "gestao-da-formacao-obrigatoria", "conteudos-multimedia", "certificacao-dgert-de-entidades-formadoras",
    ]);
    expect((await pedido(ctx, "comercial", "GET", "/v1/servicos")).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "POST", "/v1/servicos", { slug: "", ativo: true, dados: { titulo: "Intruso" } })).statusCode).toBe(403);

    // Sem endereço: feito do título; vai para o fim da lista.
    const novo = await pedido(ctx, "admin", "POST", "/v1/servicos", {
      slug: "", ativo: true,
      dados: { titulo: "Consultoria em Recursos Humanos", video: "https://youtu.be/dQw4w9WgXcQ", imagens: [{ imagem: "/api/v1/public/imagens/abc", legenda: "Sala" }] },
    });
    expect(novo.statusCode, novo.body).toBe(200);
    expect(novo.json().servico.slug).toBe("consultoria-em-recursos-humanos");
    expect((await publicos()).at(-1)).toMatchObject({ slug: "consultoria-em-recursos-humanos", titulo: "Consultoria em Recursos Humanos" });

    // Endereço repetido, vídeo de outro site e imagem de fora do site: recusados.
    expect((await pedido(ctx, "admin", "POST", "/v1/servicos", { slug: "formacao-a-medida", ativo: true, dados: { titulo: "Outro" } })).statusCode).toBe(409);
    expect((await pedido(ctx, "admin", "POST", "/v1/servicos", { slug: "", ativo: true, dados: { titulo: "Vídeo mau", video: "https://exemplo.pt/x" } })).statusCode).toBe(400);
    expect((await pedido(ctx, "admin", "POST", "/v1/servicos", { slug: "", ativo: true, dados: { titulo: "Imagem má", imagem: "javascript:alert(1)" } })).statusCode).toBe(400);

    // Escondido sai do site; apagado sai da lista.
    const id = novo.json().servico.id as number;
    await pedido(ctx, "admin", "PUT", `/v1/servicos/${id}`, { slug: "consultoria-em-recursos-humanos", ativo: false, dados: { titulo: "Consultoria em Recursos Humanos" } });
    expect((await publicos()).some(s => s.slug === "consultoria-em-recursos-humanos")).toBe(false);
    expect((await pedido(ctx, "admin", "DELETE", `/v1/servicos/${id}`)).statusCode).toBe(200);
    expect(((await pedido(ctx, "admin", "GET", "/v1/servicos")).json().servicos as { id: number }[]).some(s => s.id === id)).toBe(false);
  });
});
