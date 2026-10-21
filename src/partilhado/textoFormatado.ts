// Formatação leve dos textos longos do site (serviços para empresas): o que se escreve no backoffice é texto simples
// com umas poucas marcas, e o site (e a pré-visualização do backoffice) desenha-o com o mesmo leitor (TextoFormatado.tsx).
//
//   linha em branco      → novo parágrafo (mudança de linha simples = mudança de linha)
//   «- », «* » ou «• »   → lista com marcas (também as marcas do Word: «◦», «▪», «o» ou «§» seguidos de tabulação)
//   «1. » ou «1) »       → lista numerada
//   «## »                → subtítulo
//   **negrito**  *itálico*  [texto](https://…)  e endereços https:// soltos → ligações
//
// Nada disto produz HTML: o leitor devolve uma árvore (blocos e pedaços) que o React desenha com elementos próprios.
// Também aqui: normalizar o que se cola do Word e passar o HTML colado (Word, Google Docs) para estas marcas.

export type Pedaco =
  | { t: "texto"; v: string }
  | { t: "negrito"; f: Pedaco[] }
  | { t: "italico"; f: Pedaco[] }
  | { t: "ligacao"; href: string; f: Pedaco[] }
  | { t: "quebra" };

export type Bloco =
  | { t: "paragrafo"; f: Pedaco[] }
  | { t: "subtitulo"; f: Pedaco[] }
  | { t: "lista"; ordenada: boolean; inicio: number; itens: Pedaco[][] };

/** Ajuda curta para o backoffice. */
export const AJUDA_FORMATACAO = "Formatação: linha em branco = novo parágrafo · «- » no início da linha = lista · «1. » = lista numerada · «## » = subtítulo · **negrito** · *itálico* · ligações https://… ou [texto](https://…).";

// Marcas de lista: as habituais seguidas de espaço ou tabulação; «o» e «§» (Word, com a letra do tipo Symbol/Wingdings) só seguidas de tabulação.
const MARCA = /^[ \t]*(?:[-*•◦▪▫‣●○■□·–\uF0B7\uF0A7\uF0D8\uF0FC]|\uF02D)[ \t]+(.*)$/;
const MARCA_WORD = /^[ \t]*[o§][ \t]*\t[ \t]*(.*)$/;
const NUMERO = /^[ \t]*(\d{1,3})[.)][ \t]+(.*)$/;
const SUBTITULO = /^[ \t]*#{1,3}[ \t]+(.*)$/;

/** Item de lista (com marcas ou numerado) de uma linha, ou null. */
function itemDeLista(linha: string): { ordenada: boolean; numero: number; texto: string } | null {
  const n = NUMERO.exec(linha);
  if (n) return { ordenada: true, numero: Number(n[1]), texto: n[2]! };
  const m = MARCA.exec(linha) ?? MARCA_WORD.exec(linha);
  if (m && m[1]!.trim()) return { ordenada: false, numero: 0, texto: m[1]! };
  return null;
}

/** Lê o texto em blocos (parágrafos, subtítulos e listas). Texto sem marcas = parágrafos com as mudanças de linha. */
export function analisarTexto(texto: string | null | undefined): Bloco[] {
  const linhas = (texto ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocos: Bloco[] = [];
  let atual: { t: "paragrafo"; linhas: string[] } | { t: "lista"; ordenada: boolean; inicio: number; itens: string[][] } | null = null;
  let emBranco = false; // houve uma linha em branco depois do bloco atual
  const fechar = () => {
    if (atual?.t === "paragrafo") blocos.push({ t: "paragrafo", f: linhasEmPedacos(atual.linhas) });
    else if (atual?.t === "lista") blocos.push({ t: "lista", ordenada: atual.ordenada, inicio: atual.inicio, itens: atual.itens.map(linhasEmPedacos) });
    atual = null;
  };
  for (const linha of linhas) {
    if (!linha.trim()) { emBranco = true; continue; }
    const sub = SUBTITULO.exec(linha);
    if (sub && sub[1]!.trim()) {
      fechar();
      blocos.push({ t: "subtitulo", f: emPedacos(sub[1]!.trim()) });
      emBranco = false;
      continue;
    }
    const item = itemDeLista(linha);
    if (item) {
      // Itens seguidos (mesmo com uma linha em branco pelo meio) ficam na mesma lista.
      if (atual?.t !== "lista" || atual.ordenada !== item.ordenada) {
        fechar();
        atual = { t: "lista", ordenada: item.ordenada, inicio: item.ordenada ? item.numero : 1, itens: [] };
      }
      atual.itens.push([item.texto.trimEnd()]);
    } else if (atual?.t === "lista" && !emBranco && /^[ \t]/.test(linha)) {
      // Linha recuada logo a seguir a um item: continua esse item.
      atual.itens[atual.itens.length - 1]!.push(linha.trim());
    } else if (atual?.t === "paragrafo" && !emBranco) {
      atual.linhas.push(linha.trim());
    } else {
      fechar();
      atual = { t: "paragrafo", linhas: [linha.trim()] };
    }
    emBranco = false;
  }
  fechar();
  return blocos;
}

function linhasEmPedacos(linhas: string[]): Pedaco[] {
  const r: Pedaco[] = [];
  linhas.forEach((l, i) => {
    if (i > 0) r.push({ t: "quebra" });
    r.push(...emPedacos(l));
  });
  return r;
}

// Ligações: só https (ou páginas do próprio site, «/…», no formato [texto](/…)).
const LIGACAO_MD = /^\[([^\]\n]+)\]\((https:\/\/[^\s()]+(?:\([^\s()]*\)[^\s()]*)*|\/(?!\/)[^\s()]*)\)/;
const URL_SOLTO = /^https:\/\/[^\s<>"]+/;

/** Tira do fim de um endereço solto a pontuação da frase (e um «)» que não abriu dentro dele). */
function limparUrl(u: string) {
  let r = u;
  for (;;) {
    const ult = r.slice(-1);
    if (/[.,;:!?'"»”’]/.test(ult)) { r = r.slice(0, -1); continue; }
    if (ult === ")" && (r.match(/\(/g)?.length ?? 0) < (r.match(/\)/g)?.length ?? 0)) { r = r.slice(0, -1); continue; }
    return r;
  }
}

/** Uma linha em pedaços (negrito, itálico, ligações). As marcas sem par ficam como estão. */
export function emPedacos(s: string): Pedaco[] {
  const r: Pedaco[] = [];
  let texto = "";
  const juntar = (p: Pedaco) => {
    if (texto) { r.push({ t: "texto", v: texto }); texto = ""; }
    r.push(p);
  };
  let i = 0;
  while (i < s.length) {
    const resto = s.slice(i);
    const anterior = s[i - 1] ?? " ";
    if (resto[0] === "[") {
      const m = LIGACAO_MD.exec(resto);
      if (m) { juntar({ t: "ligacao", href: m[2]!, f: emPedacos(m[1]!) }); i += m[0].length; continue; }
    }
    if (resto.startsWith("https://") && !/[\w/]/.test(anterior)) {
      const m = URL_SOLTO.exec(resto);
      const url = m ? limparUrl(m[0]) : "";
      if (url.length > "https://".length) { juntar({ t: "ligacao", href: url, f: [{ t: "texto", v: url }] }); i += url.length; continue; }
    }
    if (resto.startsWith("**") && resto[2] && !/\s/.test(resto[2])) {
      const fim = procurarFecho(s, i + 2, "**");
      if (fim > 0) { juntar({ t: "negrito", f: emPedacos(s.slice(i + 2, fim)) }); i = fim + 2; continue; }
    }
    if (resto[0] === "*" && resto[1] && !/[\s*]/.test(resto[1]) && !/\w/.test(anterior)) {
      const fim = procurarFecho(s, i + 1, "*");
      if (fim > 0) { juntar({ t: "italico", f: emPedacos(s.slice(i + 1, fim)) }); i = fim + 1; continue; }
    }
    texto += s[i];
    i++;
  }
  if (texto) r.push({ t: "texto", v: texto });
  return r;
}

/** Posição da marca que fecha (precedida de algo que não é espaço; «*» não pode ser metade de «**»), ou -1. */
function procurarFecho(s: string, desde: number, marca: "**" | "*") {
  for (let j = desde + 1; j <= s.length - marca.length; j++) {
    if (!s.startsWith(marca, j) || /\s/.test(s[j - 1]!)) continue;
    if (marca === "*") {
      if (s[j + 1] === "*" || s[j - 1] === "*") continue;
      if (/\w/.test(s[j + 1] ?? "")) continue; // «2*3*4»: não é itálico
    }
    return j;
  }
  return -1;
}

/** Texto sem marcas (ex.: descrição para o SEO). */
export function textoSimples(texto: string | null | undefined): string {
  const pedacos = (f: Pedaco[]): string => f.map(p => (p.t === "texto" ? p.v : p.t === "quebra" ? " " : pedacos(p.f))).join("");
  return analisarTexto(texto).map(b => (b.t === "lista" ? b.itens.map(pedacos).join("; ") : pedacos(b.f))).join(" ").replace(/\s+/g, " ").trim();
}

/** Linhas dos «Pontos» (um por linha), sem as marcas de lista que venham coladas («- », «• », «1. »). */
export function linhasPontos(texto: string | null | undefined): string[] {
  return (texto ?? "").replace(/\r\n?/g, "\n").split("\n")
    .map(l => (itemDeLista(l)?.texto ?? l).trim())
    .filter(Boolean);
}

// ─── Colar no backoffice ────────────────────────────────────────────────────

/**
 * Texto colado (do Word, de um PDF, de um email): mudanças de linha do Windows passam a LF, espaços não separáveis a
 * espaços, as marcas de lista do Word («•\t», «o\t», «§\t») a «- » e os números «1.\t» a «1. »; tiram-se os espaços no
 * fim das linhas e os caracteres invisíveis. As linhas em branco e as aspas curvas ficam.
 */
export function normalizarColagem(texto: string): string {
  return texto
    .replace(/\r\n?/g, "\n")
    .replace(/[\u000b\u2028]/g, "\n")
    .replace(/[\f\u2029]/g, "\n\n")
    .replace(/[\u00A0\u202F\u2007]/g, " ")
    .replace(/[\u200B\u200C\u200D\uFEFF\u00AD]/g, "")
    .split("\n")
    .map(l => {
      const linha = l.replace(/[ \t]+$/, "");
      const num = /^[ \t]*(\d{1,3})[.)][ \t]+(.*)$/.exec(linha);
      if (num && /\t/.test(linha.slice(0, linha.length - num[2]!.length))) return `${num[1]}. ${num[2]}`;
      const m = MARCA.exec(linha) ?? MARCA_WORD.exec(linha);
      return m && m[1]!.trim() ? `- ${m[1]!.trim()}` : linha;
    })
    .join("\n");
}

/** Nó de uma árvore HTML: o que o DOMParser do navegador devolve (e o que os testes constroem à mão). */
export type NoHtml = {
  nodeType: number;
  nodeName: string;
  nodeValue: string | null;
  childNodes: ArrayLike<NoHtml>;
  getAttribute?: (nome: string) => string | null;
};

type LinhaHtml = { t: "p" | "h"; texto: string } | { t: "li"; ordenada: boolean; numero: number; texto: string };

const BLOCOS_HTML = new Set(["P", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "UL", "OL", "LI", "BLOCKQUOTE", "SECTION", "ARTICLE", "HEADER", "FOOTER", "MAIN", "BODY", "HTML", "TABLE", "TBODY", "THEAD", "TR", "PRE", "DL", "DT", "DD", "FIGURE", "ADDRESS"]);
const IGNORAR_HTML = new Set(["SCRIPT", "STYLE", "HEAD", "TITLE", "META", "LINK", "IMG", "SVG", "VIDEO", "AUDIO", "IFRAME", "OBJECT", "BUTTON", "INPUT", "SELECT", "TEXTAREA", "TEMPLATE", "XML"]);

const atributo = (n: NoHtml, a: string) => n.getAttribute?.(a) ?? "";
const nome = (n: NoHtml) => n.nodeName.toUpperCase();
const filhos = (n: NoHtml) => Array.from(n.childNodes);
// Estilos inline (Google Docs: <span style="font-weight:700">; o invólucro <b style="font-weight:normal">; Word: «mso-bidi-font-weight:normal» não conta).
const estilo = (n: NoHtml, prop: string, valor: RegExp) =>
  new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*(?:${valor.source})`, "i").test(atributo(n, "style"));
const ehNegrito = (n: NoHtml) => {
  const k = nome(n);
  if ((k === "B" || k === "STRONG") && !estilo(n, "font-weight", /normal|[1-4]00\b/)) return true;
  return estilo(n, "font-weight", /bold|bolder|[6-9]00\b/);
};
const ehItalico = (n: NoHtml) => {
  const k = nome(n);
  if ((k === "I" || k === "EM") && !estilo(n, "font-style", /normal/)) return true;
  return estilo(n, "font-style", /italic|oblique/);
};
const ehListaWord = (n: NoHtml) => /^MsoListParagraph/i.test(atributo(n, "class")) || estilo(n, "mso-list", /l\d/);
const ehMarcaWord = (n: NoHtml) => estilo(n, "mso-list", /ignore/);

/** Envolve com a marca linha a linha, com os espaços das pontas por fora (senão a marca não fecha). */
function envolver(s: string, marca: string) {
  return s.split("\n").map(l => {
    const m = /^(\s*)(.*?)(\s*)$/.exec(l)!;
    return m[2] ? `${m[1]}${marca}${m[2]}${marca}${m[3]}` : l;
  }).join("\n");
}

function emLinha(n: NoHtml, f: { negrito: boolean; italico: boolean }): string {
  if (n.nodeType === 3) return (n.nodeValue ?? "").replace(/[\s\u00A0]+/g, " ");
  if (n.nodeType !== 1) return "";
  const k = nome(n);
  if (IGNORAR_HTML.has(k) || ehMarcaWord(n)) return "";
  if (k === "BR") return "\n";
  const negrito = !f.negrito && ehNegrito(n);
  const italico = !f.italico && ehItalico(n);
  let dentro = filhos(n).map(c => emLinha(c, { negrito: f.negrito || negrito, italico: f.italico || italico })).join("");
  if (k === "A") {
    const href = atributo(n, "href").trim();
    const texto = dentro.replace(/\s+/g, " ").trim();
    if (/^https:\/\/\S+$/i.test(href) || /^\/(?!\/)\S*$/.test(href)) dentro = !texto || texto === href ? href : `[${texto.replace(/[[\]]/g, "")}](${href})`;
  }
  if (italico) dentro = envolver(dentro, "*");
  if (negrito) dentro = envolver(dentro, "**");
  return dentro;
}

function limparLinha(s: string) {
  return s.split("\n").map(l => l.replace(/ {2,}/g, " ").trim()).join("\n").replace(/^\n+|\n+$/g, "");
}

function recolher(n: NoHtml, saida: LinhaHtml[], lista: { ordenada: boolean; contador: number } | null) {
  let corrente = "";
  const despejar = () => {
    const t = limparLinha(corrente);
    if (t) saida.push({ t: "p", texto: t });
    corrente = "";
  };
  for (const c of filhos(n)) {
    const k = c.nodeType === 1 ? nome(c) : "";
    if (c.nodeType !== 1 || !BLOCOS_HTML.has(k)) {
      // Um invólucro em linha com parágrafos dentro (Google Docs: <b style="font-weight:normal" id="docs-internal-guid…">) conta como bloco.
      if (c.nodeType === 1 && !IGNORAR_HTML.has(k) && temBloco(c)) { despejar(); recolher(c, saida, null); continue; }
      corrente += emLinha(c, { negrito: false, italico: false });
      continue;
    }
    despejar();
    if (/^H[1-6]$/.test(k) || (k === "P" && /^Mso(Title|Subtitle|Heading)/i.test(atributo(c, "class")))) {
      const t = limparLinha(emLinha(c, { negrito: true, italico: false })).replace(/\n+/g, " ");
      if (t) saida.push({ t: "h", texto: t });
    } else if (k === "UL" || k === "OL") {
      const inicio = Number(atributo(c, "start")) || 1;
      recolher(c, saida, { ordenada: k === "OL", contador: inicio });
    } else if (k === "LI") {
      // O que vem dentro do item fica numa linha (parágrafos do Google Docs incluídos); listas dentro, a seguir.
      const texto = filhos(c).filter(x => !(x.nodeType === 1 && (nome(x) === "UL" || nome(x) === "OL")))
        .map(x => emLinha(x, { negrito: false, italico: false })).join(" ");
      const t = limparLinha(texto).replace(/\n+/g, " ");
      const l = lista ?? { ordenada: false, contador: 1 };
      if (t) saida.push({ t: "li", ordenada: l.ordenada, numero: l.contador, texto: t });
      l.contador++;
      // Listas dentro do item: ficam ao mesmo nível (o texto do site só tem um nível).
      recolher({ nodeType: 1, nodeName: "DIV", nodeValue: null, childNodes: filhos(c).filter(x => x.nodeType === 1 && (nome(x) === "UL" || nome(x) === "OL")) }, saida, null);
    } else if (k === "P" && ehListaWord(c)) {
      // Word: cada item é um <p class="MsoListParagraph…"> com a marca num <span style="mso-list:Ignore">.
      const marca = procurarMarcaWord(c);
      const num = /^\s*(\d{1,3})[.)]/.exec(marca ?? "");
      const t = limparLinha(emLinha(c, { negrito: false, italico: false })).replace(/\n+/g, " ")
        .replace(/^(?:[·•o§▪◦\-–\uF0B7\uF0A7]|\d{1,3}[.)])\s+/, "");
      if (t) saida.push({ t: "li", ordenada: Boolean(num), numero: num ? Number(num[1]) : 0, texto: t });
    } else if (k === "PRE") {
      const t = (filhos(c).map(x => (x.nodeType === 3 ? x.nodeValue ?? "" : emLinha(x, { negrito: false, italico: false }))).join("")).replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "");
      if (t.trim()) saida.push({ t: "p", texto: t.replace(/^\n+|\n+$/g, "") });
    } else if (k === "TR") {
      const t = filhos(c).map(x => limparLinha(emLinha(x, { negrito: false, italico: false })).replace(/\n+/g, " ")).filter(Boolean).join(" – ");
      if (t) saida.push({ t: "p", texto: t });
    } else {
      recolher(c, saida, null);
    }
  }
  despejar();
}

const temBloco = (n: NoHtml): boolean => filhos(n).some(c => c.nodeType === 1 && (BLOCOS_HTML.has(nome(c)) || temBloco(c)));

function procurarMarcaWord(n: NoHtml): string | null {
  for (const c of filhos(n)) {
    if (c.nodeType !== 1) continue;
    if (ehMarcaWord(c)) return textoDe(c);
    const r = procurarMarcaWord(c);
    if (r != null) return r;
  }
  return null;
}
const textoDe = (n: NoHtml): string => (n.nodeType === 3 ? n.nodeValue ?? "" : filhos(n).map(textoDe).join(""));

/**
 * HTML colado (Word, Google Docs, páginas web) → texto com as marcas leves: parágrafos separados por linha em branco,
 * <br> = mudança de linha, listas com «- » ou «1. », títulos com «## », negrito, itálico e ligações https.
 * Recebe a árvore já lida (no navegador: new DOMParser().parseFromString(html, "text/html").body).
 */
export function htmlParaTexto(raiz: NoHtml): string {
  const linhas: LinhaHtml[] = [];
  recolher(raiz, linhas, null);
  const partes: string[] = [];
  let anterior: LinhaHtml | null = null;
  for (const l of linhas) {
    const texto = l.t === "h" ? `## ${l.texto.replace(/\*\*/g, "")}` : l.t === "li" ? `${l.ordenada ? `${l.numero}.` : "-"} ${l.texto}` : l.texto;
    // Itens da mesma lista ficam em linhas seguidas; o resto separa-se com uma linha em branco.
    const mesmaLista = l.t === "li" && anterior?.t === "li" && anterior.ordenada === l.ordenada;
    if (partes.length) partes.push(mesmaLista ? "\n" : "\n\n");
    partes.push(texto);
    anterior = l;
  }
  return partes.join("");
}
