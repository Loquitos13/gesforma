import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";
import { cursoVisivelNoSite } from "../src/catalogoPublico.js";
import { cortarNaPalavra, RESUMO_MAX, SINTESE_MAX, textosCurso } from "../../src/partilhado/textosCurso.js";

type Publico = { titulo: string; descricao: string; resumo: string; descricaoCompleta: string; area: string; horasLabel: string };

const LONGO = "Formação certificada para quem quer ser formador em Portugal, com sessões presenciais e síncronas, trabalho em plataforma e simulação pedagógica inicial e final.\n\nSegundo parágrafo com o resto do texto completo.";

describe("textos de destaque do curso (regras)", () => {
  it("o destaque vazio sai do texto completo, cortado numa palavra com «…»", () => {
    const t = textosCurso({ sintese: LONGO });
    expect(t.completo).toBe(LONGO);
    expect(t.resumoProprio).toBe(false);
    expect(t.resumo.length).toBeLessThanOrEqual(161);
    expect(t.resumo.endsWith("…")).toBe(true);
    expect(t.resumo).not.toMatch(/\s…$/);
    // Corta numa palavra inteira: o que fica antes de «…» é início do texto.
    expect(LONGO.replace(/\s+/g, " ").startsWith(t.resumo.slice(0, -1))).toBe(true);
  });

  it("texto curto não leva «…»; o destaque próprio manda; sem texto nenhum vale o recurso", () => {
    expect(cortarNaPalavra("Curso curto.")).toBe("Curso curto.");
    expect(textosCurso({ sintese: "Curso curto.\nCom linha." }).resumo).toBe("Curso curto. Com linha.");
    expect(textosCurso({ sintese: LONGO, resumo: "  O meu destaque.  " })).toMatchObject({ resumo: "O meu destaque.", completo: LONGO, resumoProprio: true });
    expect(textosCurso({}, "Gestão. 25 horas.")).toMatchObject({ resumo: "Gestão. 25 horas.", completo: "Gestão. 25 horas." });
    // Palavra única enorme: corta a direito.
    expect(cortarNaPalavra("x".repeat(300), 160)).toBe(`${"x".repeat(160)}…`);
  });
});

describe("textos de destaque do curso (ficha e catálogo público)", () => {
  it("Gold e Financiada: gravam-se na ficha, o servidor valida os limites e o catálogo expõe os dois", async () => {
    const ctx = await arrancar();
    const catalogo = async () => (await ctx.app.inject({ method: "GET", url: "/v1/public/catalogo" })).json().cursos as Publico[];

    for (const regime of ["gold", "fin"] as const) {
      const cursos = (await pedido(ctx, "admin", "GET", `/v1/cursos/${regime}`)).json().cursos as { id: number; estado?: string }[];
      const ficha = async (id: number) => ((await pedido(ctx, "admin", "GET", `/v1/cursos/${regime}/${id}/ficha`)).json().ficha?.payload ?? {}) as Record<string, unknown>;
      // Um curso activo, com um título só dele para o encontrar no catálogo.
      const curso = cursos.find(c => cursoVisivelNoSite(c.estado));
      expect(curso, `curso ${regime} activo`).toBeTruthy();
      const id = curso!.id;
      const titulo = `Curso textos ${regime}`;
      const payload = { ...(await ficha(id)), titulo };
      const gravar = (extra: Record<string, unknown>) => pedido(ctx, "admin", "PUT", `/v1/cursos/${regime}/${id}/ficha`, { payload: { ...payload, ...extra } });
      const publico = async () => {
        const p = (await catalogo()).find(c => c.titulo === titulo);
        expect(p, `${titulo} no catálogo`).toBeTruthy();
        return p!;
      };

      // Sem destaque próprio: o de hoje (texto completo cortado); o completo é a síntese.
      expect((await gravar({ sintese: LONGO, resumo: "" })).statusCode).toBe(200);
      let p = await publico();
      expect(p.descricaoCompleta).toBe(LONGO);
      expect(p.descricao).toBe(LONGO);
      expect(p.resumo).toBe(cortarNaPalavra(LONGO));
      expect(p.resumo.endsWith("…")).toBe(true);

      // Destaque próprio: o catálogo usa-o; o completo não muda.
      expect((await gravar({ sintese: LONGO, resumo: "Torne-se formador certificado em 90 horas." })).statusCode).toBe(200);
      p = await publico();
      expect(p.resumo).toBe("Torne-se formador certificado em 90 horas.");
      expect(p.descricaoCompleta).toBe(LONGO);
      expect((await ficha(id)).resumo).toBe("Torne-se formador certificado em 90 horas.");

      // Sem texto nenhum: «Área. N horas.» nos dois, como antes.
      expect((await gravar({ sintese: "", resumo: "" })).statusCode).toBe(200);
      p = await publico();
      expect(p.descricaoCompleta).toBe(`${p.area}. ${p.horasLabel}.`);
      expect(p.resumo).toBe(p.descricaoCompleta);

      // Limites: destaque até RESUMO_MAX, completo até SINTESE_MAX; tipos errados recusados.
      expect((await gravar({ resumo: "a".repeat(RESUMO_MAX) })).statusCode).toBe(200);
      expect((await gravar({ resumo: "a".repeat(RESUMO_MAX + 1) })).statusCode).toBe(400);
      expect((await gravar({ resumo: 42 })).statusCode).toBe(400);
      expect((await gravar({ sintese: "b".repeat(SINTESE_MAX + 1) })).statusCode).toBe(400);
      expect((await ficha(id)).resumo).toBe("a".repeat(RESUMO_MAX));
    }
  });

  it("a página do curso para a Google usa o destaque na descrição e o texto completo no corpo", async () => {
    const ctx = await arrancar();
    const cursos = (await pedido(ctx, "admin", "GET", "/v1/cursos/gold")).json().cursos as { id: number; nome: string }[];
    const ccp = cursos.find(c => c.nome === "Formação de Formadores - CCP")!;
    const payload = ((await pedido(ctx, "admin", "GET", `/v1/cursos/gold/${ccp.id}/ficha`)).json().ficha?.payload ?? {}) as Record<string, unknown>;
    expect((await pedido(ctx, "admin", "PUT", `/v1/cursos/gold/${ccp.id}/ficha`, { payload: { ...payload, sintese: LONGO, resumo: "Destaque para a Google.", seoDescricao: "" } })).statusCode).toBe(200);
    const slug = ((await ctx.app.inject({ method: "GET", url: "/v1/public/catalogo" })).json().cursos as (Publico & { id: string })[]).find(c => c.titulo === String(payload.titulo || ccp.nome))!.id;
    const { metaDaPagina } = await import("../src/seo.js");
    const meta = await metaDaPagina(ctx.db, `/formacao/${slug}`);
    expect(meta.descricao).toBe("Destaque para a Google.");
    expect(JSON.stringify(meta)).toContain("Segundo parágrafo");
  });
});
