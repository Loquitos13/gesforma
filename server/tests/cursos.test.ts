import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

type Curso = { id: number; nome: string; categoria: string; uso: { turmasAbertas: number; formandos: number } };

describe("cursos, catálogos, listas e blog", () => {
  it("catálogo de cursos com uso contado no servidor e ficha com turmas", async () => {
    const ctx = await arrancar();
    const criado = await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", {
      nome: "Curso Teste Catálogo", categoria: "Área Teste", tipo: "Pré-inscrição", preco: 90, regime: "presencial", horas: 12,
    });
    expect(criado.statusCode).toBe(200);
    const id = (criado.json() as { curso: Curso }).curso.id;
    // O comercial só vende: não abre a gestão dos cursos.
    expect((await pedido(ctx, "comercial", "GET", "/v1/cursos/gold?q=Teste%20Cat%C3%A1logo")).statusCode).toBe(403);
    const lista = await pedido(ctx, "secretaria", "GET", "/v1/cursos/gold?q=Teste%20Cat%C3%A1logo");
    expect(lista.statusCode).toBe(200);
    const corpo = lista.json() as { cursos: Curso[]; resumo: { total: number } };
    expect(corpo.cursos.map(c => c.id)).toContain(id);
    expect(corpo.cursos.find(c => c.id === id)?.uso.turmasAbertas).toBe(0);
    expect(corpo.resumo.total).toBeGreaterThan(0);
    const ficha = await pedido(ctx, "secretaria", "GET", `/v1/cursos/gold/${id}`);
    expect(ficha.statusCode).toBe(200);
    expect(Array.isArray((ficha.json() as { turmas: unknown[] }).turmas)).toBe(true);
    expect((await pedido(ctx, "secretaria", "GET", "/v1/cursos/gold/abc")).statusCode).toBe(400);
    expect((await pedido(ctx, "secretaria", "GET", "/v1/cursos/gold/999999")).statusCode).toBe(404);
  });

  it("renomear uma área propaga aos cursos; apagar com uso é recusado", async () => {
    const ctx = await arrancar();
    const area = await pedido(ctx, "secretaria", "POST", "/v1/catalog/areas", { regime: "gold", payload: { nome: "Área Propagar", estado: "Ativo" } });
    const areaId = (area.json() as { item: { id: number } }).item.id;
    await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", {
      nome: "Curso Com Área", categoria: "Área Propagar", tipo: "Pré-inscrição", preco: 10, regime: "presencial", horas: 5,
    });
    const itens = (await pedido(ctx, "secretaria", "GET", "/v1/catalogos/areas?regime=gold")).json() as { itens: { id: number; uso: { cursos: number } }[] };
    expect(itens.itens.find(i => i.id === areaId)?.uso.cursos).toBe(1);
    expect((await pedido(ctx, "secretaria", "DELETE", `/v1/catalog/areas/${areaId}`)).statusCode).toBe(409);
    await pedido(ctx, "secretaria", "PATCH", `/v1/catalog/areas/${areaId}`, { payload: { nome: "Área Nova", estado: "Ativo" } });
    const cursos = (await pedido(ctx, "secretaria", "GET", "/v1/cursos/gold?q=Curso%20Com%20%C3%81rea")).json() as { cursos: Curso[] };
    expect(cursos.cursos[0]?.categoria).toBe("Área Nova");
    expect((await pedido(ctx, "secretaria", "GET", "/v1/catalogos/naoexiste")).statusCode).toBe(400);
    expect((await pedido(ctx, "formador", "POST", "/v1/catalog/locais", { payload: { nome: "X" } })).statusCode).toBe(403);
  });

  it("listas de opções: uso por opção e renomear actualiza os registos numa transacção", async () => {
    const ctx = await arrancar();
    const criada = await pedido(ctx, "secretaria", "POST", "/v1/listas/tipos_curso", { nome: "Tipo Renomear" });
    expect(criada.statusCode).toBe(200);
    const opcaoId = (criada.json() as { opcao: { id: number } }).opcao.id;
    expect((await pedido(ctx, "secretaria", "POST", "/v1/listas/tipos_curso", { nome: "tipo renomear" })).statusCode).toBe(409);
    await pedido(ctx, "secretaria", "POST", "/v1/cursos-gold", {
      nome: "Curso Tipo Lista", categoria: "X", tipo: "Tipo Renomear", preco: 1, regime: "presencial", horas: 1,
    });
    const antes = (await pedido(ctx, "secretaria", "GET", "/v1/listas/tipos_curso")).json() as { opcoes: { id: number; uso: number }[] };
    expect(antes.opcoes.find(o => o.id === opcaoId)?.uso).toBe(1);
    const ren = await pedido(ctx, "secretaria", "POST", `/v1/listas/tipos_curso/${opcaoId}/renomear`, { nome: "Tipo Renomeado" });
    expect(ren.statusCode).toBe(200);
    expect((ren.json() as { registos: number }).registos).toBe(1);
    const cursos = (await pedido(ctx, "secretaria", "GET", "/v1/cursos/gold?q=Curso%20Tipo%20Lista")).json() as { cursos: { tipo: string }[] };
    expect(cursos.cursos[0]?.tipo).toBe("Tipo Renomeado");
    expect((await pedido(ctx, "comercial", "POST", `/v1/listas/tipos_curso/${opcaoId}/renomear`, { nome: "Outro" })).statusCode).toBe(403);
    expect((await pedido(ctx, "secretaria", "GET", "/v1/listas/naoexiste")).statusCode).toBe(400);
    const resumo = (await pedido(ctx, "secretaria", "GET", "/v1/listas")).json() as { listas: { id: string }[] };
    expect(resumo.listas.map(l => l.id)).toContain("origens");
  });

  it("blog: slug único e validado; site público só mostra publicações activas", async () => {
    const ctx = await arrancar();
    const base = { titulo: "Notícia de teste", slug: "noticia-teste-unica", data: "2026-10-01", status: "Ativo", corpo: "" };
    expect((await pedido(ctx, "secretaria", "POST", "/v1/blog", base)).statusCode).toBe(200);
    expect((await pedido(ctx, "secretaria", "POST", "/v1/blog", base)).statusCode).toBe(409);
    expect((await pedido(ctx, "secretaria", "POST", "/v1/blog", { ...base, slug: "Slug Mau!" })).statusCode).toBe(400);
    expect((await pedido(ctx, "financiada", "POST", "/v1/blog", { ...base, slug: "outra" })).statusCode).toBe(403);
    expect((await pedido(ctx, "comercial", "POST", "/v1/blog", { ...base, slug: "do-comercial" })).statusCode).toBe(403);
    const lista = (await pedido(ctx, "secretaria", "GET", "/v1/blog?q=teste")).json() as { posts: { slug: string }[] };
    expect(lista.posts.map(p => p.slug)).toContain("noticia-teste-unica");
    expect((await pedido(ctx, null, "GET", "/v1/public/noticias/noticia-teste-unica")).statusCode).toBe(200);
    expect((await pedido(ctx, null, "GET", "/v1/public/noticias/nao-existe")).statusCode).toBe(404);
  });
});
