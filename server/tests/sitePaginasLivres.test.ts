// Páginas livres do site: o administrador cria (título e endereço), edita, publica e apaga; o site lê a publicada.
import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

describe("páginas livres do site", () => {
  it("criar, publicar, ler no site, recusar endereços reservados e apagar", async () => {
    const ctx = await arrancar();
    expect((await pedido(ctx, "secretaria", "POST", "/v1/site/paginas-livres", { titulo: "Sobre nós", endereco: "sobre-nos" })).statusCode).toBe(403);
    const r = await pedido(ctx, "admin", "POST", "/v1/site/paginas-livres", { titulo: "Sobre nós", endereco: "sobre-nos" });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ pagina: "livre-sobre-nos" });
    expect((await pedido(ctx, "admin", "POST", "/v1/site/paginas-livres", { titulo: "Outra", endereco: "sobre-nos" })).statusCode).toBe(409);
    expect((await pedido(ctx, "admin", "POST", "/v1/site/paginas-livres", { titulo: "Cursos", endereco: "formacao" })).statusCode).toBe(409);
    expect((await pedido(ctx, "admin", "POST", "/v1/site/paginas-livres", { titulo: "Mau", endereco: "Sobre Nós!" })).statusCode).toBe(400);

    const publica = async () => (await ctx.app.inject({ method: "GET", url: "/v1/public/site/paginas/livre-sobre-nos" })).json() as { dados: unknown; titulo?: string };
    expect((await publica()).dados).toBeNull();
    const dados = { root: { props: {} }, content: [{ type: "Titulo", props: { id: "t1", texto: "Sobre nós" } }] };
    expect((await pedido(ctx, "admin", "PUT", "/v1/site/paginas/livre-sobre-nos/publicar", { dados })).statusCode).toBe(200);
    expect(await publica()).toMatchObject({ dados, titulo: "Sobre nós" });
    const lista = (await pedido(ctx, "admin", "GET", "/v1/site/paginas-livres")).json() as { paginas: { endereco: string; titulo: string }[] };
    expect(lista.paginas).toEqual([expect.objectContaining({ endereco: "sobre-nos", titulo: "Sobre nós" })]);

    expect((await pedido(ctx, "admin", "DELETE", "/v1/site/paginas-livres/livre-sobre-nos")).statusCode).toBe(200);
    expect((await publica()).dados).toBeNull();
    expect((await pedido(ctx, "admin", "DELETE", "/v1/site/paginas-livres/inicio")).statusCode).toBe(400);
  });
});
