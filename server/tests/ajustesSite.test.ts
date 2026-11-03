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

  it("cria a política de privacidade e os termos publicados, uma vez; o rodapé ganha «Termos e condições»", async () => {
    const ctx = await arrancar();
    const { aplicarAjustesSite, criarPaginasSite } = await import("../src/db/ajustesSite.js");
    const { redirecionamentoAntigo } = await import("../src/seoRedirecionamentos.js");
    await ctx.db.query("DELETE FROM ajustes_site");
    await ctx.db.query("DELETE FROM site_paginas WHERE pagina IN ('moldura', 'livre-politica-de-privacidade', 'livre-termos-e-condicoes')");
    expect(await redirecionamentoAntigo(ctx.db, "/termos-e-condicoes")).toMatchObject({ estado: 302 });
    const ligacoes = "Notícias e artigos | /noticias\nPolítica de privacidade | https://ena.pt/politica-de-privacidade\nLivro de reclamações | https://www.livroreclamacoes.pt";
    await ctx.db.query("INSERT INTO site_paginas (pagina, rascunho, publicado) VALUES ('moldura', $1::jsonb, $1::jsonb)", [JSON.stringify({
      root: { props: {} }, content: [{ type: "Rodape", props: { id: "r", colunas: [{ titulo: "Ligações", linhas: ligacoes }] } }],
    })]);

    await aplicarAjustesSite(ctx.db);
    await criarPaginasSite(ctx.db);
    // Mudada depois de criada (Sistema › Site): o arranque seguinte não a repõe.
    await ctx.db.query("UPDATE site_paginas SET titulo = 'Privacidade' WHERE pagina = 'livre-politica-de-privacidade'");
    await criarPaginasSite(ctx.db);

    const publica = async (p: string) => {
      const r = await ctx.app.inject({ method: "GET", url: `/v1/public/site/paginas/livre-${p}` });
      expect(r.statusCode).toBe(200);
      return r.json() as { dados: unknown; titulo?: string };
    };
    const politica = await publica("politica-de-privacidade");
    expect(politica.titulo).toBe("Privacidade");
    expect(JSON.stringify(politica.dados)).toContain("3. Direito de Retificação");
    const dadosTermos = (await publica("termos-e-condicoes")).dados as { content: { props: { conteudo: { props: { conteudo: { props: Record<string, unknown> }[] } }[] } }[] };
    const blocosTermos = dadosTermos.content[0]!.props.conteudo[0]!.props.conteudo.map(b => b.props);
    expect(blocosTermos[0]).toMatchObject({ nivel: "h1", texto: "Termos e condições de inscrição e acesso" });
    const termos = JSON.stringify(dadosTermos);
    expect(termos).toContain("Política de Cancelamento e Devolução");
    expect(termos).toContain('"ligacao":"/politica-de-privacidade"');
    // Com a página publicada, o endereço deixa de ir para o site antigo.
    expect(await redirecionamentoAntigo(ctx.db, "/termos-e-condicoes")).toBeNull();

    const moldura = (await ctx.db.query<{ publicado: { content: { props: { colunas: { titulo: string; linhas: string }[] } }[] } }>(
      "SELECT publicado FROM site_paginas WHERE pagina = 'moldura'")).rows[0]!.publicado;
    expect(moldura.content[0]!.props.colunas.find(c => c.titulo === "Ligações")!.linhas).toBe(ligacoes.replace(
      "politica-de-privacidade\n", "politica-de-privacidade\nTermos e condições | /termos-e-condicoes\n"));
  });
});
