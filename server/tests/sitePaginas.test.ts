import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

const pagina = (titulo: string) => ({
  root: { props: { corPrimaria: "#14263D" } },
  content: [{ type: "Seccao", props: { id: "s1", conteudo: [{ type: "Titulo", props: { id: "t1", texto: titulo } }] } }],
});

describe("páginas do site (editor visual)", () => {
  it("rascunho fica privado; publicar mostra no site; só o admin edita", async () => {
    const ctx = await arrancar();
    expect((await ctx.app.inject({ method: "GET", url: "/v1/public/site/paginas/inicio" })).json()).toEqual({ dados: null });

    expect((await pedido(ctx, "secretaria", "PUT", "/v1/site/paginas/inicio/publicar", { dados: pagina("x") })).statusCode).toBe(403);
    expect((await pedido(ctx, "secretaria", "GET", "/v1/site/paginas/inicio")).statusCode).toBe(403);

    const rasc = await pedido(ctx, "admin", "PUT", "/v1/site/paginas/inicio/rascunho", { dados: pagina("Rascunho") });
    expect(rasc.statusCode, rasc.body).toBe(200);
    expect((await ctx.app.inject({ method: "GET", url: "/v1/public/site/paginas/inicio" })).json()).toEqual({ dados: null });

    const pub = await pedido(ctx, "admin", "PUT", "/v1/site/paginas/inicio/publicar", { dados: pagina("Publicado") });
    expect(pub.statusCode, pub.body).toBe(200);
    const publico = (await ctx.app.inject({ method: "GET", url: "/v1/public/site/paginas/inicio" })).json();
    expect(publico.dados.content[0].props.conteudo[0].props.texto).toBe("Publicado");

    const lida = (await pedido(ctx, "admin", "GET", "/v1/site/paginas/inicio")).json();
    expect(lida.publicadoEm).toBeTruthy();
    expect(lida.rascunho.content[0].props.conteudo[0].props.texto).toBe("Publicado");
  });

  it("todas as páginas do site se publicam em separado", async () => {
    const ctx = await arrancar();
    for (const p of ["catalogo", "curso", "noticias", "empresas", "area"]) {
      const r = await pedido(ctx, "admin", "PUT", `/v1/site/paginas/${p}/publicar`, { dados: pagina(`Página ${p}`) });
      expect(r.statusCode, `${p}: ${r.body}`).toBe(200);
    }
    const empresas = (await ctx.app.inject({ method: "GET", url: "/v1/public/site/paginas/empresas" })).json();
    expect(empresas.dados.content[0].props.conteudo[0].props.texto).toBe("Página empresas");
    const blocos = { root: { props: {} }, content: [{ type: "Catalogo", props: { id: "c" } }, { type: "ListaNoticias", props: { id: "n" } }, { type: "AreaFormando", props: { id: "a" } }] };
    expect((await pedido(ctx, "admin", "PUT", "/v1/site/paginas/area/rascunho", { dados: blocos })).statusCode).toBe(200);
    // Página do curso em blocos soltos.
    const curso = {
      root: { props: { previsualizar: "" } },
      content: ["CursoBanner", "CursoSintese", "CursoDados", "CursoObjetivos", "CursoPrograma", "CursoTurmas", "CursoInscricao"]
        .map((type, i) => ({ type, props: { id: `c${i}` } })),
    };
    const r = await pedido(ctx, "admin", "PUT", "/v1/site/paginas/curso/rascunho", { dados: curso });
    expect(r.statusCode, r.body).toBe(200);
  });

  it("recusa blocos desconhecidos e páginas sem conteúdo", async () => {
    const ctx = await arrancar();
    const mau = { root: { props: {} }, content: [{ type: "Script", props: { id: "x" } }] };
    expect((await pedido(ctx, "admin", "PUT", "/v1/site/paginas/inicio/publicar", { dados: mau })).statusCode).toBe(400);
    expect((await pedido(ctx, "admin", "PUT", "/v1/site/paginas/inicio/publicar", { dados: { root: {} } })).statusCode).toBe(400);
    expect((await pedido(ctx, "admin", "PUT", "/v1/site/paginas/outra/publicar", { dados: pagina("x") })).statusCode).toBe(400);
  });
});
