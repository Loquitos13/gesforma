import { afterEach, describe, expect, it, vi } from "vitest";
import { arrancar, pedido } from "./helpers.js";

const CHAVE = "AIzaChaveDeTesteComMaisDeVinteCaracteres";
const PLACE = "ChIJ_ficha_da_ENA_teste";

/** Responde como a Places API (New) e conta os pedidos que chegam à Google. */
function googleFalso(estado = 200) {
  const chamadas: { url: string; chave: string }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    chamadas.push({ url: String(url), chave: String((init?.headers as Record<string, string>)?.["X-Goog-Api-Key"] ?? "") });
    if (estado !== 200) return new Response(JSON.stringify({ error: { message: "API key not valid" } }), { status: estado });
    return new Response(JSON.stringify({
      rating: 4.8, userRatingCount: 132, googleMapsUri: "https://maps.google.com/?cid=1",
      reviews: [
        { rating: 5, relativePublishTimeDescription: "há 1 semana", text: { text: "Excelente formação!" }, authorAttribution: { displayName: "Ana", uri: "https://g/ana", photoUri: "https://g/ana.jpg" } },
        { rating: 4, text: { text: "" }, authorAttribution: { displayName: "Sem texto" } },
      ],
    }), { status: 200 });
  }));
  return chamadas;
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("avaliações Google (configuradas no backoffice)", () => {
  it("só o admin configura; a chave fica cifrada e nunca sai; o site lê a cópia sem pedir de novo à Google", async () => {
    const ctx = await arrancar();
    const chamadas = googleFalso();

    expect((await pedido(ctx, "secretaria", "PUT", "/v1/settings/google-avaliacoes", { placeId: PLACE, chave: CHAVE })).statusCode).toBe(403);
    const g = await pedido(ctx, "admin", "PUT", "/v1/settings/google-avaliacoes", { placeId: PLACE, chave: CHAVE });
    expect(g.statusCode, g.body).toBe(200);
    expect(g.json()).toMatchObject({ configurado: true, placeId: PLACE, rating: 4.8, total: 132, quantas: 1 });
    expect(g.body).not.toContain(CHAVE);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]!.chave).toBe(CHAVE);
    expect(chamadas[0]!.url).toContain(PLACE);

    // A rota genérica das definições não mostra nem deixa reescrever a entrada.
    const todas = await pedido(ctx, "admin", "GET", "/v1/settings");
    expect(todas.body).not.toContain(CHAVE);
    expect(todas.body).not.toContain("google_avaliacoes");
    expect((await pedido(ctx, "admin", "PUT", "/v1/settings/google_avaliacoes", { values: { placeId: "x" } })).statusCode).toBe(403);

    const site = await ctx.app.inject({ method: "GET", url: "/v1/public/avaliacoes-google" });
    expect(site.statusCode).toBe(200);
    expect(site.json()).toEqual({
      rating: 4.8, total: 132, url: "https://maps.google.com/?cid=1",
      avaliacoes: [{ autor: "Ana", autorUrl: "https://g/ana", foto: "https://g/ana.jpg", estrelas: 5, texto: "Excelente formação!", quando: "há 1 semana", data: "" }],
    });
    expect(site.body).not.toContain(CHAVE);
    expect(chamadas).toHaveLength(1); // cópia do dia: a visita ao site não vai à Google
  });

  it("chave errada não fica gravada; sem configuração o site recebe uma lista vazia", async () => {
    const ctx = await arrancar();
    // A base de testes é partilhada no ficheiro: desligar limpa o que o teste anterior gravou.
    expect((await pedido(ctx, "admin", "POST", "/v1/settings/google-avaliacoes/desligar")).json()).toMatchObject({ configurado: false });
    googleFalso(400);
    const r = await pedido(ctx, "admin", "PUT", "/v1/settings/google-avaliacoes", { placeId: PLACE, chave: CHAVE });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toContain("API key not valid");
    expect((await pedido(ctx, "admin", "GET", "/v1/settings/google-avaliacoes")).json()).toMatchObject({ configurado: false, temChave: false });
    expect((await ctx.app.inject({ method: "GET", url: "/v1/public/avaliacoes-google" })).json()).toEqual({ rating: null, total: 0, url: "", avaliacoes: [] });
  });
});
