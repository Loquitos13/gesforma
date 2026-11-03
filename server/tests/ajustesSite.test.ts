// Ajustes de conteúdo às páginas gravadas: menu, rodapé, «Siga a ENA», testemunhos, mapa e «Notícias e artigos».
import { describe, expect, it } from "vitest";
import { arrancar } from "./helpers.js";

describe("ajustes ao conteúdo do site", () => {
  it("mexe só no que encontra, nas versões rascunho e publicada, uma vez", async () => {
    const ctx = await arrancar();
    const { aplicarAjustesSite } = await import("../src/db/ajustesSite.js");
    await ctx.db.query("DELETE FROM ajustes_site");
    await ctx.db.query("DELETE FROM site_paginas WHERE pagina IN ('moldura', 'inicio', 'empresas', 'noticias')");
    const moldura = { root: { props: {} }, content: [
      { type: "Cabecalho", props: { id: "c", ligacoes: [
        { rotulo: "Cursos Gold", ligacao: "/formacao?linha=gold" }, { rotulo: "Empresas", ligacao: "/empresas" },
        { rotulo: "Cursos Financiados", ligacao: "/formacao?linha=financiada" }, { rotulo: "Blog", ligacao: "/noticias" }] } },
      { type: "Rodape", props: { id: "r", colunas: [{ titulo: "Contactos", linhas: "2ª a 6ª" }, { titulo: "Ligações", linhas: "Notícias | /noticias" }] } },
    ] };
    const inicio = { root: { props: {} }, content: [
      { type: "Cabecalho", props: { id: "c2", ligacoes: [], __disp: { base: { ligacoes: [
        { rotulo: "Cursos Gold", ligacao: "/a" }, { rotulo: "Empresas", ligacao: "/empresas" }, { rotulo: "Cursos Financiados", ligacao: "/b" }] } } } },
      { type: "Seccao", props: { id: "s1", conteudo: [{ type: "RedesSociais", props: { id: "rs" } }] } },
      { type: "Seccao", props: { id: "s2", conteudo: [{ type: "Testemunhos", props: { id: "t", itens: [{ nome: "Ana" }] } }] } },
      { type: "Rodape", props: { id: "r2", colunas: [], __disp: { base: { colunas: [{ titulo: "Contactos", linhas: "x" }] }, tel: { aparencia: {} } } } },
    ] };
    const pagina = async (p: string, d: unknown) => ctx.db.query(
      "INSERT INTO site_paginas (pagina, rascunho, publicado) VALUES ($1, $2::jsonb, $2::jsonb)", [p, JSON.stringify(d)]);
    await pagina("moldura", moldura);
    await pagina("inicio", inicio);
    await pagina("empresas", { root: { props: {} }, content: [] });
    await pagina("noticias", { root: { props: {} }, content: [{ type: "Titulo", props: { id: "h", texto: "Notícias" } }] });

    await aplicarAjustesSite(ctx.db);
    await aplicarAjustesSite(ctx.db);
    const ler = async (p: string) => (await ctx.db.query<{ publicado: { content: { type: string; props: Record<string, unknown> }[] } }>(
      "SELECT publicado FROM site_paginas WHERE pagina = $1", [p])).rows[0]!.publicado;

    const m = await ler("moldura");
    expect((m.content[0]!.props.ligacoes as { rotulo: string }[]).map(l => l.rotulo))
      .toEqual(["Cursos Gold", "Cursos Financiados", "Empresas", "Notícias e artigos"]);
    const rod = m.content[1]!.props as { colunas: { linhas: string }[]; logos: unknown[] };
    expect(rod.colunas[0]!.linhas).toContain("223 781 100");
    expect(rod.colunas[1]!.linhas).toBe("Notícias e artigos | /noticias");
    expect(rod.logos.length).toBe(2);

    const ini = await ler("inicio");
    // Valores por ecrã (__disp.base) também mudam; as secções novas ficam antes do rodapé da página.
    const base = (ini.content[0]!.props.__disp as { base: { ligacoes: { rotulo: string }[] } }).base;
    expect(base.ligacoes.map(l => l.rotulo)).toEqual(["Cursos Gold", "Cursos Financiados", "Empresas"]);
    expect(ini.content.at(-1)!.type).toBe("Rodape");
    const rodBase = (ini.content.at(-1)!.props.__disp as { base: { colunas: { linhas: string }[]; logos: unknown[] }; tel: Record<string, unknown> });
    expect(rodBase.base.colunas[0]!.linhas).toContain("geral@ena.pt");
    expect(rodBase.base.logos.length).toBe(2);
    expect(rodBase.tel.colunas).toBeUndefined();
    const i = JSON.stringify(ini);
    expect(i).not.toContain("RedesSociais");
    expect(i).toContain("João Almeida");
    expect(i.match(/"type":"Mapa"/g)?.length).toBe(1);
    expect(JSON.stringify(await ler("empresas"))).toContain('"mostrarBotao":false');
    expect(JSON.stringify(await ler("noticias"))).toContain("Notícias e artigos");
  });
});
