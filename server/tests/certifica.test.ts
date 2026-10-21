import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

// Página Certifica (pedido da Carla): a página da certificação DGERT fica geral, com dois cartões que levam a dois serviços
// próprios — Certificação Inicial (entidades formadoras) e Alargamento (novos cursos / áreas de formação).

const MAE = "certificacao-dgert-de-entidades-formadoras";
const FILHOS = ["certificacao-inicial", "alargamento-da-certificacao"];
const MODELO = '<!doctype html><html lang="pt"><head><meta charset="UTF-8" /><title>GesForma - ENA</title></head><body><div id="root"></div></body></html>';

type Ctx = Awaited<ReturnType<typeof arrancar>>;
type Cartao = { titulo: string; texto: string; rotulo?: string; ligacao?: string };
type Publico = { slug: string; titulo: string; texto: string; detalhe?: string; pai?: string; cartoes?: Cartao[]; ctaTitulo?: string };
type Linha = { id: number; slug: string; ativo: boolean; ordem: number; dados: Record<string, unknown> };

const publicos = async (ctx: Ctx) => (await ctx.app.inject({ method: "GET", url: "/v1/public/servicos" })).json().servicos as Publico[];
const todos = async (ctx: Ctx) => (await pedido(ctx, "admin", "GET", "/v1/servicos")).json().servicos as Linha[];
const pagina = (ctx: Ctx, caminho: string) =>
  ctx.app.inject({ method: "GET", url: `/v1/public/pagina?caminho=${encodeURIComponent(caminho)}`, headers: { "x-forwarded-host": "ena.pt" } });

/** Corre outra vez a migração 190, como o servidor a corre (partida em «;» no fim da linha). */
async function correrMigracao(ctx: Ctx) {
  const sql = readFileSync(join(import.meta.dirname, "../src/db/migrations/190_servicos_certifica.sql"), "utf8");
  for (const parte of sql.split(/;\s*\n/).map(s => s.trim()).filter(Boolean)) await ctx.db.query(parte.endsWith(";") ? parte : `${parte};`);
}

describe("Página Certifica: dois serviços com página própria", () => {
  it("existem os dois serviços, dentro da Certifica, e a página principal tem um cartão para cada", async () => {
    const ctx = await arrancar();
    const lista = await publicos(ctx);
    const mae = lista.find(s => s.slug === MAE)!;
    expect(mae).toMatchObject({ titulo: "Certificação DGERT", ctaTitulo: "Não sabe qual é o seu caso?" });
    expect(mae.pai ?? "").toBe("");
    expect(mae.cartoes?.map(c => [c.titulo, c.ligacao])).toEqual([
      ["Certificação Inicial", "/empresas/certificacao-inicial"],
      ["Alargamento", "/empresas/alargamento-da-certificacao"],
    ]);
    for (const slug of FILHOS) {
      const s = lista.find(x => x.slug === slug);
      expect(s, slug).toBeDefined();
      expect(s!.pai).toBe(MAE);
      expect(s!.texto.length).toBeGreaterThan(20);
    }
    expect(lista.find(s => s.slug === "certificacao-inicial")!.titulo).toBe("Certificação Inicial");
    expect(lista.find(s => s.slug === "alargamento-da-certificacao")!.titulo).toBe("Alargamento da certificação");
  });

  it("as três páginas resolvem com título, descrição e migalhas (os dois serviços dentro da Certifica) e entram no sitemap", async () => {
    const ctx = await arrancar();
    (await import("../src/seo.js")).definirModeloHtml(MODELO);
    await pedido(ctx, "admin", "PUT", "/v1/settings/seo", { values: { indexar: "1", url: "https://ena.pt" } });
    const principal = await pagina(ctx, `/empresas/${MAE}`);
    expect(principal.statusCode).toBe(200);
    expect(principal.body).toContain("<title>Certificação DGERT");
    for (const [slug, titulo] of [["certificacao-inicial", "Certificação Inicial"], ["alargamento-da-certificacao", "Alargamento da certificação"]] as const) {
      const r = await pagina(ctx, `/empresas/${slug}`);
      expect(r.statusCode, slug).toBe(200);
      expect(r.body).toContain(`<title>${titulo}`);
      expect(r.body).toMatch(/<meta name="description" content="[^"]{30,}"/);
      const ld = JSON.parse(r.body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]!) as { "@graph": { "@type": string; itemListElement?: { item: string }[] }[] };
      const migalhas = ld["@graph"].find(x => x["@type"] === "BreadcrumbList")!.itemListElement!.map(i => i.item);
      expect(migalhas).toEqual(["https://ena.pt/", "https://ena.pt/empresas", `https://ena.pt/empresas/${MAE}`, `https://ena.pt/empresas/${slug}`]);
    }
    const sitemap = (await ctx.app.inject({ method: "GET", url: "/v1/public/sitemap.xml", headers: { "x-forwarded-host": "ena.pt" } })).body;
    for (const slug of [MAE, ...FILHOS]) expect(sitemap).toContain(`https://ena.pt/empresas/${slug}`);
  });

  it("cada serviço recebe o seu pedido de proposta", async () => {
    const ctx = await arrancar();
    const email = `certifica.${Date.now()}@entidade.pt`;
    for (const servico of ["Certificação Inicial", "Alargamento da certificação"]) {
      const r = await ctx.app.inject({ method: "POST", url: "/v1/public/pedidos-proposta", payload: { nome: "Carla Teste", empresa: "Entidade Formadora", email, servico, mensagem: `Quero saber mais: ${servico}.` } });
      expect(r.statusCode, r.body).toBe(200);
    }
    const pedidos = (await pedido(ctx, "admin", "GET", "/v1/pedidos-proposta")).json().pedidos as { email: string; servico: string }[];
    expect(pedidos.filter(p => p.email === email).map(p => p.servico).sort()).toEqual(["Alargamento da certificação", "Certificação Inicial"]);
  });

  it("o backoffice grava a página-mãe e os cartões com ligação; recusa um serviço dentro de si próprio", async () => {
    const ctx = await arrancar();
    const filho = (await todos(ctx)).find(s => s.slug === "certificacao-inicial")!;
    const gravar = (dados: Record<string, unknown>) => pedido(ctx, "admin", "PUT", `/v1/servicos/${filho.id}`, { slug: filho.slug, ativo: true, ordem: filho.ordem, dados });
    const r = await gravar({ ...filho.dados, texto: "Texto novo da Carla.", cartoes: [{ titulo: "Passo", texto: "x", rotulo: "Ver", ligacao: "/empresas" }] });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().servico.dados).toMatchObject({ pai: MAE, texto: "Texto novo da Carla.", cartoes: [{ titulo: "Passo", rotulo: "Ver", ligacao: "/empresas" }] });
    expect((await gravar({ ...filho.dados, pai: "certificacao-inicial" })).statusCode).toBe(400);
    expect((await gravar({ ...filho.dados, pai: "Não É Endereço" })).statusCode).toBe(400);
  });

  it("a migração não estraga o que já foi escrito e não repete os cartões nem os serviços", async () => {
    const ctx = await arrancar();
    const mae = (await todos(ctx)).find(s => s.slug === MAE)!;
    const proprios = [{ titulo: "Vantagem escrita pela equipa", texto: "Fica.", rotulo: "", ligacao: "" }];
    const r = await pedido(ctx, "admin", "PUT", `/v1/servicos/${mae.id}`, {
      slug: MAE, ativo: true, ordem: mae.ordem, dados: { ...mae.dados, titulo: "Certifica", detalhe: "Texto da equipa.", cartoes: proprios },
    });
    expect(r.statusCode, r.body).toBe(200);
    await correrMigracao(ctx);
    await correrMigracao(ctx);
    const lista = await publicos(ctx);
    const depois = lista.find(s => s.slug === MAE)!;
    expect(depois.titulo).toBe("Certifica");
    expect(depois.detalhe).toBe("Texto da equipa.");
    expect(depois.cartoes?.map(c => c.titulo)).toEqual(["Vantagem escrita pela equipa", "Certificação Inicial", "Alargamento"]);
    expect(lista.filter(s => FILHOS.includes(s.slug))).toHaveLength(2);
  });
});
