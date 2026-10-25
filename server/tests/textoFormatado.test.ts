import { describe, expect, it } from "vitest";
import { analisarTexto, emPedacos, htmlParaTexto, linhasPontos, normalizarColagem, textoSimples, type NoHtml } from "../../src/partilhado/textoFormatado.js";
import { LIMITES_SERVICO, textosProprios } from "../../src/partilhado/siteServicos.js";

// Árvore HTML mínima (o que o DOMParser do navegador devolve, só com o que o conversor usa).
type No = NoHtml & { childNodes: No[] };
const t = (v: string): No => ({ nodeType: 3, nodeName: "#text", nodeValue: v, childNodes: [] });
const comentario = (v: string): No => ({ nodeType: 8, nodeName: "#comment", nodeValue: v, childNodes: [] });
const el = (nome: string, atrs: Record<string, string> = {}, ...filhos: (No | string)[]): No => ({
  nodeType: 1, nodeName: nome.toUpperCase(), nodeValue: null,
  childNodes: filhos.map(f => (typeof f === "string" ? t(f) : f)),
  getAttribute: (a: string) => atrs[a] ?? null,
});

describe("Formatação leve dos textos dos serviços", () => {
  it("texto antigo, sem marcas: parágrafos (linha em branco) com as mudanças de linha", () => {
    expect(analisarTexto("Linha 1\nLinha 2\r\n\r\n\nOutro parágrafo")).toEqual([
      { t: "paragrafo", f: [{ t: "texto", v: "Linha 1" }, { t: "quebra" }, { t: "texto", v: "Linha 2" }] },
      { t: "paragrafo", f: [{ t: "texto", v: "Outro parágrafo" }] },
    ]);
    expect(analisarTexto("")).toEqual([]);
    expect(analisarTexto("   \n  ")).toEqual([]);
  });

  it("listas (incluindo as marcas do Word), numeradas, subtítulos, negrito, itálico e ligações", () => {
    const blocos = analisarTexto([
      "## O que fazemos",
      "Texto com **negrito** e *itálico*.",
      "- um",
      "• dois",
      "o\ttrês (Word)",
      "§\tquatro",
      "",
      "- cinco, ainda a mesma lista",
      "Depois da lista.",
      "",
      "3. terceiro",
      "4) quarto",
      "   continua o quarto",
      "Veja https://ena.pt/empresas. Ou [a página](/empresas/certifica).",
    ].join("\n"));
    expect(blocos.map(b => b.t)).toEqual(["subtitulo", "paragrafo", "lista", "paragrafo", "lista", "paragrafo"]);
    expect(blocos[0]).toEqual({ t: "subtitulo", f: [{ t: "texto", v: "O que fazemos" }] });
    expect(blocos[1]).toEqual({ t: "paragrafo", f: [
      { t: "texto", v: "Texto com " }, { t: "negrito", f: [{ t: "texto", v: "negrito" }] }, { t: "texto", v: " e " },
      { t: "italico", f: [{ t: "texto", v: "itálico" }] }, { t: "texto", v: "." },
    ] });
    const lista = blocos[2] as Extract<(typeof blocos)[number], { t: "lista" }>;
    expect(lista.ordenada).toBe(false);
    expect(lista.itens.map(i => (i[0] as { v: string }).v)).toEqual(["um", "dois", "três (Word)", "quatro", "cinco, ainda a mesma lista"]);
    expect(blocos[4]).toEqual({ t: "lista", ordenada: true, inicio: 3, itens: [
      [{ t: "texto", v: "terceiro" }],
      [{ t: "texto", v: "quarto" }, { t: "quebra" }, { t: "texto", v: "continua o quarto" }],
    ] });
    expect(blocos[5]).toEqual({ t: "paragrafo", f: [
      { t: "texto", v: "Veja " }, { t: "ligacao", href: "https://ena.pt/empresas", f: [{ t: "texto", v: "https://ena.pt/empresas" }] },
      { t: "texto", v: ". Ou " }, { t: "ligacao", href: "/empresas/certifica", f: [{ t: "texto", v: "a página" }] }, { t: "texto", v: "." },
    ] });
  });

  it("o que não é marca fica como está (nada se perde)", () => {
    const so = (s: string) => emPedacos(s);
    expect(so("2*3*4 e 5 * 6")).toEqual([{ t: "texto", v: "2*3*4 e 5 * 6" }]);
    expect(so("**sem fecho")).toEqual([{ t: "texto", v: "**sem fecho" }]);
    expect(so("[x](javascript:alert(1)) http://inseguro.pt")).toEqual([{ t: "texto", v: "[x](javascript:alert(1)) http://inseguro.pt" }]);
    expect(so("[x](//outro.site)")).toEqual([{ t: "texto", v: "[x](//outro.site)" }]);
    expect(so("(ver https://ena.pt/a_(b))")).toEqual([
      { t: "texto", v: "(ver " }, { t: "ligacao", href: "https://ena.pt/a_(b)", f: [{ t: "texto", v: "https://ena.pt/a_(b)" }] }, { t: "texto", v: ")" },
    ]);
    // «-5%» e «2024.» não são listas; espaços seguidos e tabulações ficam no texto.
    expect(analisarTexto("-5% em 2024.\nA\t\tB  C").map(b => b.t)).toEqual(["paragrafo"]);
    expect(JSON.stringify(analisarTexto("A\t\tB  C"))).toContain("A\\t\\tB  C");
  });

  it("texto simples para o SEO e pontos sem as marcas coladas", () => {
    expect(textoSimples("## Título\n\n**Forte** e *leve*.\n- um\n- dois\n\nVer [site](https://ena.pt).")).toBe("Título Forte e leve. um; dois Ver site.");
    expect(linhasPontos("- um\n• dois\n\n3. três\nquatro\r\n  ")).toEqual(["um", "dois", "três", "quatro"]);
  });

  it("colar texto do Word: CRLF, espaços não separáveis, marcas e espaços no fim; linhas em branco e aspas ficam", () => {
    const colado = "Título com espaço   \r\n\r\n•\tPrimeiro\r\no\tSegundo\r\n§\tTerceiro\r\n1.\tPasso um\r\n\r\n«Aspas» e “curvas”​\t";
    expect(normalizarColagem(colado)).toBe("Título com espaço\n\n- Primeiro\n- Segundo\n- Terceiro\n1. Passo um\n\n«Aspas» e “curvas”");
    // Linha a começar por «o» sem tabulação não é marca.
    expect(normalizarColagem("o cliente decide")).toBe("o cliente decide");
  });

  it("colar HTML do Word: negrito, listas (MsoListParagraph), títulos, ligações https; o resto sai", () => {
    const word = el("body", {},
      el("div", { class: "WordSection1" },
        el("p", { class: "MsoNormal" }, el("b", {}, el("span", { style: "font-size:12.0pt" }, "Formação à medida")), el("span", {}, " para a\nsua equipa."), el("o:p", {})),
        el("p", { class: "MsoNormal" }, el("o:p", {}, " ")),
        el("p", { class: "MsoListParagraphCxSpFirst", style: "text-indent:-18.0pt;mso-list:l0 level1 lfo1" },
          comentario("[if !supportLists]"), el("span", { style: "font-family:Symbol;mso-list:Ignore" }, "·", el("span", { style: "font:7.0pt" }, "     ")), comentario("[endif]"), "Diagnóstico"),
        el("p", { class: "MsoListParagraphCxSpLast", style: "mso-list:l0 level1 lfo1" }, "·   Programa com ", el("i", {}, "módulos"), " "),
        el("h2", {}, el("b", {}, "Como funciona")),
        el("p", { class: "MsoListParagraph", style: "mso-list:l1 level1 lfo2" }, el("span", { style: "mso-list:Ignore" }, "1.", el("span", {}, " ")), "Primeiro passo"),
        el("p", {}, "Veja ", el("a", { href: "https://ena.pt/x" }, "o site"), " ou ", el("a", { href: "javascript:alert(1)" }, "isto"), ".", el("br"), "Linha nova"),
        el("p", {}, el("b", { style: "mso-bidi-font-weight:normal" }, "Sempre negrito")),
        el("style", {}, "p { color: red }"),
      ));
    expect(htmlParaTexto(word)).toBe([
      "**Formação à medida** para a sua equipa.",
      "",
      "- Diagnóstico",
      "- Programa com *módulos*",
      "",
      "## Como funciona",
      "",
      "1. Primeiro passo",
      "",
      "Veja [o site](https://ena.pt/x) ou isto.",
      "Linha nova",
      "",
      "**Sempre negrito**",
    ].join("\n"));
    // E o que sai lê-se com a mesma estrutura.
    expect(analisarTexto(htmlParaTexto(word)).map(b => b.t)).toEqual(["paragrafo", "lista", "subtitulo", "lista", "paragrafo", "paragrafo"]);
  });

  it("colar HTML do Google Docs: o invólucro <b style=font-weight:normal> não é negrito; ul/li com <p> dentro", () => {
    const docs = el("body", {},
      el("meta", { charset: "utf-8" }),
      el("b", { style: "font-weight:normal;", id: "docs-internal-guid-123" },
        el("p", { dir: "ltr" }, el("span", { style: "font-weight:400;font-style:normal" }, "Olá "), el("span", { style: "font-weight:700" }, "mundo")),
        el("br"),
        el("ul", {}, el("li", {}, el("p", {}, el("span", {}, "um"))), el("li", {}, el("p", {}, el("span", { style: "font-style:italic" }, "dois")),
          el("ul", {}, el("li", {}, "dentro")))),
        el("ol", { start: "2" }, el("li", {}, "b"), el("li", {}, "c")),
      ));
    expect(htmlParaTexto(docs)).toBe("Olá **mundo**\n\n- um\n- *dois*\n- dentro\n\n2. b\n3. c");
  });

  it("títulos por nível, destaque, nota e sublinhado (textos do curso)", () => {
    const blocos = analisarTexto("# Título\n### Pequeno\n> Linha um\n> linha dois\n\n-# Nota\n\nTexto __sublinhado__ e nome__do__ficheiro.");
    expect(blocos.map(b => b.t)).toEqual(["subtitulo", "subtitulo", "destaque", "nota", "paragrafo"]);
    expect(blocos[0]).toMatchObject({ nivel: 1 });
    expect(blocos[1]).toMatchObject({ nivel: 3 });
    expect(blocos[2]).toEqual({ t: "destaque", f: [{ t: "texto", v: "Linha um" }, { t: "quebra" }, { t: "texto", v: "linha dois" }] });
    expect(blocos[4]).toEqual({ t: "paragrafo", f: [
      { t: "texto", v: "Texto " }, { t: "sublinhado", f: [{ t: "texto", v: "sublinhado" }] }, { t: "texto", v: " e nome__do__ficheiro." },
    ] });
    // Colado: <u>, sublinhado por estilo, h1/h3 e citação.
    const html = el("body", {},
      el("h1", {}, "Grande"), el("h3", {}, "Pequeno"),
      el("p", {}, "A ", el("u", {}, "sub"), " e ", el("span", { style: "text-decoration:underline" }, "linha")),
      el("blockquote", {}, "Citação"));
    expect(htmlParaTexto(html)).toBe("# Grande\n\n### Pequeno\n\nA __sub__ e __linha__\n\n> Citação");
  });

  it("limites únicos e textos próprios da página Empresas (editor do site)", () => {
    expect(LIMITES_SERVICO).toMatchObject({ texto: 1200, detalhe: 12000, cartaoTexto: 2000, ctaTexto: 1200 });
    const pagina = { root: {}, content: [{ type: "Servicos", props: { porServico: [
      { slug: "certifica", titulo: "", texto: "Texto antigo do cartão", pontos: "  " },
      { slug: "certifica", titulo: "Ignorado: conta a primeira linha", texto: "", pontos: "" },
      { slug: "outro", titulo: "", texto: "", pontos: "" },
    ] } }] };
    expect(textosProprios(pagina, "certifica")).toEqual({ texto: "Texto antigo do cartão" });
    expect(textosProprios(pagina, "outro")).toBeNull();
    expect(textosProprios(null, "certifica")).toBeNull();
  });
});
