import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

const MODELO = '<!doctype html><html lang="pt"><head><meta charset="UTF-8" /><title>GesForma - ENA</title></head><body><div id="root"></div><script type="module" src="/assets/app.js"></script></body></html>';

async function preparar() {
  const ctx = await arrancar();
  const { definirModeloHtml } = await import("../src/seo.js");
  definirModeloHtml(MODELO);
  return ctx;
}
/** Pedido como chega da Vercel: o domínio que o visitante abriu vem em x-forwarded-host. */
const pagina = (ctx: Awaited<ReturnType<typeof arrancar>>, caminho: string, host = "ena.pt") =>
  ctx.app.inject({ method: "GET", url: `/v1/public/pagina?caminho=${encodeURIComponent(caminho)}`, headers: { "x-forwarded-host": host } });
const pub = (ctx: Awaited<ReturnType<typeof arrancar>>, url: string, host = "ena.pt") =>
  ctx.app.inject({ method: "GET", url, headers: { "x-forwarded-host": host } });
const jsonLd = (html: string) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]!) as { "@graph": Record<string, unknown>[] };

describe("SEO do site", () => {
  it("por omissão o site fica fora da pesquisa (endereço de testes) até se ligar a indexação", async () => {
    const ctx = await preparar();
    expect((await pub(ctx, "/v1/public/robots.txt")).body).toBe("User-agent: *\nDisallow: /\n");
    expect((await pagina(ctx, "/")).body).toContain('content="noindex, nofollow"');
    expect((await pub(ctx, "/v1/public/sitemap.xml")).body).not.toContain("<url>");
  });

  it("cada página leva título, descrição, canónico, partilha e dados estruturados; a app continua a carregar", async () => {
    const ctx = await preparar();
    await pedido(ctx, "admin", "PUT", "/v1/settings/seo", { values: { indexar: "1", url: "https://ena.pt" } });
    const r = await pagina(ctx, "/");
    expect(r.statusCode).toBe(200);
    expect(r.headers["content-type"]).toContain("text/html");
    expect(r.headers["cache-control"]).toContain("s-maxage");
    expect(r.body).toContain('<html lang="pt-PT"');
    expect(r.body).toMatch(/<meta name="description" content="[^"]{20,}"/);
    expect(r.body).toContain('<meta name="robots" content="index, follow');
    expect(r.body).toContain('<meta property="og:title"');
    expect(r.body).toContain('<script type="module" src="/assets/app.js">');
    const g = jsonLd(r.body)["@graph"];
    expect(g.map(x => x["@type"])).toEqual(expect.arrayContaining(["EducationalOrganization", "WebSite"]));

    const catalogo = (await ctx.app.inject({ method: "GET", url: "/v1/public/catalogo" })).json().cursos as { id: string; titulo: string }[];
    const c = catalogo[0]!;
    const rc = await pagina(ctx, `/formacao/${c.id}`);
    expect(rc.statusCode).toBe(200);
    expect(rc.body).toContain(`<link rel="canonical" href="`);
    expect(rc.body).toContain(`/formacao/${c.id}"`);
    const curso = jsonLd(rc.body)["@graph"].find(x => x["@type"] === "Course")!;
    expect(curso).toMatchObject({ name: c.titulo, provider: expect.any(Object) });
    expect(curso.hasCourseInstance).toBeTruthy();
    expect(jsonLd(rc.body)["@graph"].some(x => x["@type"] === "BreadcrumbList")).toBe(true);
  });

  it("curso inexistente dá 404; backoffice e área do formando não se indexam", async () => {
    const ctx = await preparar();
    const r = await pagina(ctx, "/formacao/curso-que-nao-existe");
    expect(r.statusCode).toBe(404);
    expect(r.body).toContain('content="noindex, nofollow"');
    for (const p of ["/gesforma/painel", "/area-formando", "/ligacao/abc123"]) {
      const x = await pagina(ctx, p);
      expect(x.statusCode, p).toBe(200);
      expect(x.body, p).toContain('content="noindex, nofollow"');
      expect(x.body, p).not.toContain('rel="canonical"');
    }
  });

  it("cada serviço ativo tem página e entra no sitemap; escondido ou inexistente dá 404", async () => {
    const ctx = await preparar();
    await pedido(ctx, "admin", "PUT", "/v1/settings/seo", { values: { indexar: "1", url: "https://ena.pt" } });
    // Os serviços iniciais (migração) já têm página.
    const r = await pagina(ctx, "/empresas/conteudos-multimedia");
    expect(r.statusCode).toBe(200);
    expect(r.body).toContain("<title>Conteúdos multimédia");
    expect(jsonLd(r.body)["@graph"].map(x => x["@type"])).toContain("Service");
    expect((await pub(ctx, "/v1/public/sitemap.xml")).body).toContain("https://ena.pt/empresas/certificacao-dgert-de-entidades-formadoras");
    const novo = await pedido(ctx, "admin", "POST", "/v1/servicos", { slug: "coaching", ativo: true, dados: { titulo: "Coaching de equipas", texto: "Curto.", detalhe: "Sessões de coaching para equipas de vendas." } });
    expect(novo.statusCode, novo.body).toBe(200);
    expect((await pagina(ctx, "/empresas/coaching")).body).toContain("Sessões de coaching para equipas de vendas.");
    const id = novo.json().servico.id as number;
    await pedido(ctx, "admin", "PUT", `/v1/servicos/${id}`, { slug: "coaching", ativo: false, dados: { titulo: "Coaching de equipas" } });
    expect((await pagina(ctx, "/empresas/coaching")).statusCode).toBe(404);
    expect((await pagina(ctx, "/empresas/nao-existe")).statusCode).toBe(404);
  });

  it("só o admin configura; verificação da Search Console e do Bing; texto malicioso não entra como código", async () => {
    const ctx = await preparar();
    const valores = {
      nomeSite: "ENA</script><script>alert(1)</script>",
      googleVerificacao: '<meta name="google-site-verification" content="abc123XYZ_-" />',
      bingVerificacao: "BING987",
      inicioTitulo: "Formação certificada em Gaia e Lisboa",
    };
    expect((await pedido(ctx, "secretaria", "PUT", "/v1/settings/seo", { values: valores })).statusCode).toBe(403);
    expect((await pedido(ctx, "admin", "PUT", "/v1/settings/seo", { values: valores })).statusCode).toBe(200);
    const r = await pagina(ctx, "/");
    expect(r.body).toContain('<meta name="google-site-verification" content="abc123XYZ_-" />');
    expect(r.body).toContain('<meta name="msvalidate.01" content="BING987" />');
    expect(r.body).toContain("<title>Formação certificada em Gaia e Lisboa</title>");
    expect(r.body).not.toContain("<script>alert(1)</script>");
    expect(jsonLd(r.body)["@graph"][0]).toBeTruthy();
  });

  it("sitemap e robots; desligar a indexação fecha tudo", async () => {
    const ctx = await preparar();
    await pedido(ctx, "admin", "PUT", "/v1/settings/seo", { values: { indexar: "1", url: "https://ena.pt" } });
    const s = await pub(ctx, "/v1/public/sitemap.xml");
    expect(s.headers["content-type"]).toContain("xml");
    expect(s.body).toContain("<loc>https://ena.pt/</loc>");
    expect(s.body).toContain("<loc>https://ena.pt/formacao/");
    const robots = (await pub(ctx, "/v1/public/robots.txt")).body;
    expect(robots).toContain("Sitemap: https://ena.pt/sitemap.xml");
    expect(robots).toContain("Disallow: /gesforma");

    await pedido(ctx, "admin", "PUT", "/v1/settings/seo", { values: { indexar: "0", url: "https://ena.pt" } });
    expect((await pub(ctx, "/v1/public/robots.txt")).body).toContain("Disallow: /\n");
    expect((await pub(ctx, "/v1/public/sitemap.xml")).body).not.toContain("<url>");
    expect((await pagina(ctx, "/")).body).toContain('content="noindex, nofollow"');
  });

  it("com o interruptor ligado, só o domínio real (com ou sem www) se indexa; o endereço de testes fica fora", async () => {
    const ctx = await preparar();
    await pedido(ctx, "admin", "PUT", "/v1/settings/seo", { values: { indexar: "1", url: "https://ena.pt" } });
    expect((await pagina(ctx, "/", "ena.pt")).body).toContain('content="index, follow');
    expect((await pagina(ctx, "/", "www.ena.pt")).body).toContain('content="index, follow');
    const teste = await pagina(ctx, "/", "gesforma-alpha.vercel.app");
    expect(teste.body).toContain('content="noindex, nofollow"');
    expect(teste.body).not.toContain('rel="canonical"');
    expect((await pub(ctx, "/v1/public/robots.txt", "gesforma-alpha.vercel.app")).body).toBe("User-agent: *\nDisallow: /\n");
    expect((await pub(ctx, "/v1/public/sitemap.xml", "gesforma-alpha.vercel.app")).body).not.toContain("<url>");
  });

  it("na Vercel, páginas, sitemap e robots vão para as rotas de SEO; a API fica como estava", async () => {
    const { rotaInterna } = await import("../src/vercel.js");
    expect(rotaInterna("/api/v1/me")).toEqual({ url: "/v1/me", pagina: false });
    expect(rotaInterna("/formacao/ccp?utm_source=x")).toEqual({ url: "/v1/public/pagina?caminho=%2Fformacao%2Fccp", pagina: true });
    expect(rotaInterna("/api?__pagina=/")).toEqual({ url: "/v1/public/pagina?caminho=%2F", pagina: true });
    expect(rotaInterna("/api?__pagina=/sitemap.xml")).toEqual({ url: "/v1/public/sitemap.xml", pagina: true });
    expect(rotaInterna("/robots.txt")).toEqual({ url: "/v1/public/robots.txt", pagina: true });
  });
});
