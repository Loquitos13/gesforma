import { describe, expect, it } from "vitest";
import { arrancar, pedido } from "./helpers.js";

describe("Serviços para empresas (Gestão › Empresas / Business)", () => {
  it("só a administração escreve; o site vê os ativos pela ordem; endereço único e conteúdo validado", async () => {
    const ctx = await arrancar();
    const publicos = async () => (await ctx.app.inject({ method: "GET", url: "/v1/public/servicos" })).json().servicos as { slug: string; titulo: string }[];
    // Começa com os serviços que o site já mostrava.
    expect((await publicos()).map(s => s.slug)).toEqual([
      "formacao-a-medida", "formacao-certificada", "gestao-da-formacao-obrigatoria", "conteudos-multimedia", "certificacao-dgert-de-entidades-formadoras",
      "certificacao-inicial", "alargamento-da-certificacao",
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

describe("Modelo da página de serviço no editor", () => {
  it("grava rascunho e publica", async () => {
    const ctx = await arrancar();
    const dados = { root: { props: {} }, content: [{ type: "ServicoBanner", props: { id: "b1" } }] };
    expect((await pedido(ctx, "admin", "PUT", "/v1/site/paginas/servico/rascunho", { dados })).statusCode).toBe(200);
    expect((await pedido(ctx, "admin", "PUT", "/v1/site/paginas/servico/publicar", { dados })).statusCode).toBe(200);
    const noticia = { root: { props: {} }, content: [{ type: "NoticiaCabecalho", props: { id: "n1" } }, { type: "NoticiaCorpo", props: { id: "n2" } }] };
    expect((await pedido(ctx, "admin", "PUT", "/v1/site/paginas/noticia/publicar", { dados: noticia })).statusCode).toBe(200);
  });
});

describe("Pedido de proposta (formulário da página Empresas)", () => {
  it("fica nas Clientes do CRM (junta ao cliente com o mesmo email), recusa dados maus e ignora robôs", async () => {
    const ctx = await arrancar();
    const enviar = (corpo: Record<string, unknown>) => ctx.app.inject({ method: "POST", url: "/v1/public/pedidos-proposta", payload: corpo });
    const email = `rh.${Date.now()}@empresa.pt`;
    expect((await enviar({ nome: "Ana Lima", empresa: "Empresa Teste", email, telefone: "912 345 678", servico: "Formação à medida", mensagem: "Formação para 20 pessoas." })).statusCode).toBe(200);
    expect((await enviar({ nome: "Ana Lima", empresa: "Empresa Teste", email: email.toUpperCase(), mensagem: "Segundo pedido." })).statusCode).toBe(200);
    const linhas = (await ctx.db.query<{ nome: string; tipo: string; telf: string; notas: string }>("SELECT nome, tipo, telf, notas FROM crm_clientes WHERE lower(email) = $1", [email])).rows;
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ nome: "Empresa Teste", tipo: "Empresa", telf: "912 345 678" });
    // A mensagem fica só no pedido; as notas do cliente levam uma linha curta de quando foi criado.
    expect(linhas[0]!.notas).toContain("Pedido de proposta no site (Formação à medida): Ana Lima");
    expect(linhas[0]!.notas).not.toContain("Formação para 20 pessoas.");
    const pedidos = (await ctx.db.query<{ mensagem: string }>("SELECT mensagem FROM pedidos_proposta WHERE lower(email) = $1 ORDER BY id", [email])).rows;
    expect(pedidos.map(x => x.mensagem)).toEqual(["Formação para 20 pessoas.", "Segundo pedido."]);
    expect((await enviar({ nome: "Ana", email: "sem-arroba" })).statusCode).toBe(400);
    const robo = `robo.${Date.now()}@spam.pt`;
    expect((await enviar({ nome: "Robô", email: robo, site: "https://spam" })).statusCode).toBe(200);
    expect((await ctx.db.query("SELECT 1 FROM crm_clientes WHERE email = $1", [robo])).rows).toHaveLength(0);
  });

  it("os serviços guardam a imagem do topo, os cartões e a faixa final", async () => {
    const ctx = await arrancar();
    const r = await pedido(ctx, "admin", "POST", "/v1/servicos", {
      slug: "", ativo: true,
      dados: { titulo: "Serviço com cartões", capa: "/api/v1/public/imagens/abc", tituloDetalhe: "O que fazemos", cartoes: [{ titulo: "Vantagem", texto: "Explicação." }], ctaTitulo: "Fale connosco", ctaTexto: "Texto final." },
    });
    expect(r.statusCode, r.body).toBe(200);
    const s = ((await ctx.app.inject({ method: "GET", url: "/v1/public/servicos" })).json().servicos as Record<string, unknown>[]).find(x => x.slug === "servico-com-cartoes");
    expect(s).toMatchObject({ capa: "/api/v1/public/imagens/abc", tituloDetalhe: "O que fazemos", cartoes: [{ titulo: "Vantagem", texto: "Explicação." }], ctaTitulo: "Fale connosco" });
  });
});
