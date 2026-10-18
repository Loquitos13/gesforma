/**
 * SEO do site público. O site é uma aplicação de uma página: sem isto, a Google e as redes sociais recebem sempre
 * o mesmo HTML («GesForma - ENA»). Aqui monta-se, para cada endereço, o título, a descrição, o endereço canónico,
 * os dados de partilha (Open Graph/Twitter), os dados estruturados (schema.org em JSON-LD) e um conteúdo mínimo
 * legível sem JavaScript; e ainda o sitemap.xml e o robots.txt. Tudo se configura em Sistema › Site › SEO.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lerDocumento, textoDoCorpo } from "../../src/partilhado/blogBlocos.js";
import { config } from "./config.js";
import type { Db } from "./db/pool.js";
import { listarCatalogoPublico, type CursoPublico } from "./catalogoPublico.js";
import { lerEntidadePublica } from "./regrasConfig.js";
import { noticiaPublica, noticiasPublicas } from "./repos/blog.js";
import { ativos as servicosAtivos } from "./repos/servicos.js";
import { lerDefinicao } from "./repos/settings.js";

export const ID_SEO = "seo";

/** Chaves gravadas em app_settings «seo» (tudo texto; vazio = valor por omissão). */
export const CHAVES_SEO = [
  "indexar", "url", "nomeSite", "descricao", "imagem", "logo", "googleVerificacao", "bingVerificacao", "redesSociais",
  "inicioTitulo", "inicioDescricao", "formacaoTitulo", "formacaoDescricao",
  "noticiasTitulo", "noticiasDescricao", "empresasTitulo", "empresasDescricao",
] as const;
type Seo = Record<(typeof CHAVES_SEO)[number], string>;

export type MetaPagina = {
  estado: 200 | 404;
  titulo: string;
  descricao: string;
  canonico: string;
  imagem: string;
  tipo: "website" | "article";
  indexar: boolean;
  jsonLd: object[];
  /** Conteúdo mínimo dentro de #root (o React substitui-o ao arrancar). */
  corpo: string;
};

const limpar = (s: string) => s.replace(/\s+/g, " ").trim();
const cortar = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…`);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Aceita o código ou a meta tag inteira colada da Search Console / Bing. */
const codigoVerificacao = (v: string) => limpar(v.match(/content=["']([^"']+)["']/i)?.[1] ?? v).replace(/[^A-Za-z0-9_\-=.:]/g, "");

async function lerSeo(db: Db): Promise<Seo> {
  const v = await lerDefinicao(db, ID_SEO).catch(() => ({}));
  return Object.fromEntries(CHAVES_SEO.map(k => [k, typeof (v as Record<string, unknown>)[k] === "string" ? String((v as Record<string, unknown>)[k]) : ""])) as Seo;
}

/**
 * Só se indexa com o interruptor ligado E quando o pedido chega ao domínio configurado (ex.: ena.pt ou www.ena.pt):
 * uma cópia de testes (gesforma-alpha.vercel.app) nunca aparece na pesquisa, mesmo com o interruptor ligado.
 */
export function podeIndexar(seo: { indexar: string; url: string }, host?: string) {
  if (seo.indexar !== "1") return false;
  if (!host) return true;
  const alvo = (seo.url.trim() || config.appOrigin).match(/^https?:\/\/([^/:]+)/i)?.[1]?.toLowerCase();
  if (!alvo) return false;
  const h = host.toLowerCase().split(":")[0]!.replace(/^www\./, "");
  return h === alvo.replace(/^www\./, "");
}

function origemDo(seo: Seo) {
  const u = seo.url.trim().replace(/\/+$/, "");
  return /^https?:\/\/[^\s/]+/.test(u) ? u : config.appOrigin;
}

const absoluto = (origem: string, u: string) => (!u ? "" : /^https?:\/\//.test(u) ? u : `${origem}${u.startsWith("/") ? "" : "/"}${u}`);

/** Dados da organização (EducationalOrganization) para todas as páginas. */
async function organizacao(db: Db, seo: Seo, origem: string) {
  const e = await lerEntidadePublica(db).catch(() => null);
  const nome = seo.nomeSite || e?.nomeCurto || e?.nome || "ENA";
  const redes = seo.redesSociais.split(/\r?\n/).map(s => s.trim()).filter(s => /^https?:\/\//.test(s));
  const org: Record<string, unknown> = {
    "@type": "EducationalOrganization", "@id": `${origem}/#organizacao`,
    name: e?.nome || nome, alternateName: nome !== e?.nome ? nome : undefined,
    url: origem, logo: absoluto(origem, seo.logo || "/imagens/ena-logo-nobg.png"),
    email: e?.email || undefined, telephone: e?.telefone || undefined,
    address: e?.morada ? {
      "@type": "PostalAddress", streetAddress: e.morada, postalCode: e.codigoPostal || undefined,
      addressLocality: e.localidade || undefined, addressCountry: "PT",
    } : undefined,
    sameAs: redes.length ? redes : undefined,
  };
  return { nome, org };
}

const migalhas = (origem: string, itens: [string, string][]) => ({
  "@type": "BreadcrumbList",
  itemListElement: itens.map(([nome, caminho], i) => ({ "@type": "ListItem", position: i + 1, name: nome, item: `${origem}${caminho}` })),
});

const MODO: Record<string, string> = { Presencial: "Onsite", "E-learning": "Online", "B-learning": "Blended" };

/** schema.org/Course: o que a Google pede para os resultados de cursos (fornecedor, oferta e edições). */
function dadosCurso(c: CursoPublico, origem: string, descricao: string) {
  const horas = Number(c.horasLabel.match(/\d+([.,]\d+)?/)?.[0]?.replace(",", "."));
  const edicoes = c.sessoes.filter(s => s.iso).slice(0, 12).map(s => ({
    "@type": "CourseInstance",
    courseMode: MODO[c.modalidade] ?? "Onsite",
    startDate: s.iso,
    ...(horas > 0 ? { courseWorkload: `PT${Math.round(horas)}H` } : {}),
    ...(s.local && c.modalidade !== "E-learning" ? {
      location: { "@type": "Place", name: s.local, ...(s.morada ? { address: { "@type": "PostalAddress", streetAddress: s.morada, addressCountry: "PT" } } : {}) },
    } : {}),
  }));
  const gratuito = c.regime === "fin";
  return {
    "@type": "Course", "@id": `${origem}/formacao/${c.id}#curso`,
    name: c.titulo, description: descricao, url: `${origem}/formacao/${c.id}`,
    image: c.capa ? absoluto(origem, c.capa) : undefined,
    inLanguage: "pt-PT",
    provider: { "@id": `${origem}/#organizacao` },
    about: c.area || undefined,
    offers: gratuito
      ? { "@type": "Offer", category: "Free", price: 0, priceCurrency: "EUR" }
      : c.precoDesde != null ? { "@type": "Offer", category: "Paid", price: c.precoDesde, priceCurrency: "EUR", url: `${origem}/formacao/${c.id}` } : undefined,
    hasCourseInstance: edicoes.length ? edicoes : [{ "@type": "CourseInstance", courseMode: MODO[c.modalidade] ?? "Onsite", ...(horas > 0 ? { courseWorkload: `PT${Math.round(horas)}H` } : {}) }],
  };
}

const ligacoesCursos = (cursos: CursoPublico[]) =>
  `<ul>${cursos.slice(0, 60).map(c => `<li><a href="/formacao/${encodeURIComponent(c.id)}">${esc(c.titulo)}</a></li>`).join("")}</ul>`;

/** Título, descrição e dados de um endereço do site. Endereços privados (backoffice, área do formando, ligações pessoais) não se indexam. */
export async function metaDaPagina(db: Db, caminhoBruto: string, host?: string): Promise<MetaPagina> {
  const seo = await lerSeo(db);
  const origem = origemDo(seo);
  const caminho = (`/${caminhoBruto.split("?")[0]!.replace(/^\/+/, "")}`).replace(/\/+$/, "") || "/";
  // Desligada até se ligar em Sistema › Site › SEO: um endereço de testes nunca deve aparecer na pesquisa.
  const indexarSite = podeIndexar(seo, host);
  const { nome, org } = await organizacao(db, seo, origem);
  const site = { "@type": "WebSite", "@id": `${origem}/#site`, name: nome, url: origem, inLanguage: "pt-PT", publisher: { "@id": `${origem}/#organizacao` } };
  const descricaoBase = limpar(seo.descricao) || "Formação certificada: formação de formadores (CCP), cursos autofinanciados e formação financiada.";
  const imagemBase = absoluto(origem, seo.imagem || "/imagens/ena-logo-nobg.png");
  const comNome = (t: string) => (t.includes(nome) ? t : `${t} | ${nome}`);
  const base = (p: Partial<MetaPagina>): MetaPagina => ({
    estado: 200, titulo: nome, descricao: descricaoBase, canonico: `${origem}${caminho === "/" ? "/" : caminho}`, imagem: imagemBase,
    tipo: "website", indexar: indexarSite, corpo: "", ...p,
    jsonLd: [{ "@context": "https://schema.org", "@graph": [org, site, ...(p.jsonLd ?? [])] }],
  });
  const privada = (titulo: string) => base({ titulo: comNome(titulo), indexar: false });

  if (caminho === "/") {
    const { cursos } = await listarCatalogoPublico(db);
    const titulo = limpar(seo.inicioTitulo) || `${nome} | Formação certificada`;
    const descricao = limpar(seo.inicioDescricao) || descricaoBase;
    return base({ titulo, descricao, corpo: `<h1>${esc(titulo)}</h1><p>${esc(descricao)}</p><nav aria-label="Cursos">${ligacoesCursos(cursos)}</nav>` });
  }
  if (caminho === "/formacao") {
    const { cursos } = await listarCatalogoPublico(db);
    const titulo = comNome(limpar(seo.formacaoTitulo) || "Oferta formativa");
    const descricao = limpar(seo.formacaoDescricao) || `Todos os cursos da ${nome}: presenciais, b-learning e e-learning, autofinanciados e financiados.`;
    return base({
      titulo, descricao,
      jsonLd: [
        migalhas(origem, [["Início", "/"], ["Formação", "/formacao"]]),
        { "@type": "ItemList", itemListElement: cursos.slice(0, 100).map((c, i) => ({ "@type": "ListItem", position: i + 1, url: `${origem}/formacao/${c.id}` })) },
      ],
      corpo: `<h1>${esc(limpar(seo.formacaoTitulo) || "Oferta formativa")}</h1><p>${esc(descricao)}</p>${ligacoesCursos(cursos)}`,
    });
  }
  if (caminho.startsWith("/formacao/")) {
    const slug = decodeURIComponent(caminho.slice("/formacao/".length).split("/")[0] ?? "").toLowerCase();
    const { cursos } = await listarCatalogoPublico(db);
    const c = cursos.find(x => x.id === slug);
    if (!c) return base({ estado: 404, titulo: comNome("Curso não encontrado"), indexar: false, corpo: "<h1>Este curso não está na oferta.</h1><p><a href=\"/formacao\">Ver todos os cursos</a></p>" });
    const descricao = cortar(limpar(c.seoDescricao || c.descricao), 160);
    const titulo = comNome(limpar(c.seoTitulo) || c.titulo);
    return base({
      titulo, descricao, imagem: c.capa ? absoluto(origem, c.capa) : imagemBase,
      jsonLd: [migalhas(origem, [["Início", "/"], ["Formação", "/formacao"], [c.titulo, `/formacao/${c.id}`]]), dadosCurso(c, origem, descricao)],
      corpo: `<h1>${esc(c.titulo)}</h1><p>${esc(c.descricao)}</p><p>${esc([c.modalidade, c.horasLabel, c.precoLabel].filter(Boolean).join(" · "))}</p>`,
    });
  }
  if (caminho === "/noticias") {
    const lista = await noticiasPublicas(db).catch(() => []);
    const titulo = comNome(limpar(seo.noticiasTitulo) || "Notícias");
    const descricao = limpar(seo.noticiasDescricao) || `Novidades, eventos e artigos da ${nome}.`;
    return base({
      titulo, descricao, jsonLd: [migalhas(origem, [["Início", "/"], ["Notícias", "/noticias"]])],
      corpo: `<h1>Notícias</h1><p>${esc(descricao)}</p><ul>${lista.slice(0, 50).map(n => `<li><a href="/noticias/${encodeURIComponent(n.slug)}">${esc(n.titulo)}</a></li>`).join("")}</ul>`,
    });
  }
  if (caminho.startsWith("/noticias/")) {
    const slug = decodeURIComponent(caminho.slice("/noticias/".length).split("/")[0] ?? "");
    const n = /^[a-z0-9-]{1,160}$/.test(slug) ? await noticiaPublica(db, slug).catch(() => null) : null;
    if (!n || n.status !== "Ativo") return base({ estado: 404, titulo: comNome("Notícia não encontrada"), indexar: false, corpo: "<h1>Notícia não encontrada</h1><p><a href=\"/noticias\">Ver as notícias</a></p>" });
    const texto = limpar(textoDoCorpo(n.corpo));
    const meta = lerDocumento(n.corpo).meta;
    // O excerto e a imagem de destaque do artigo (Gestão › Blog), quando existem.
    const descricao = cortar(limpar(meta?.excerto ?? "") || texto, 160);
    const imagemArtigo = meta?.capa ? absoluto(origem, meta.capa) : imagemBase;
    return base({
      titulo: comNome(n.titulo), descricao, tipo: "article", imagem: imagemArtigo,
      jsonLd: [
        migalhas(origem, [["Início", "/"], ["Notícias", "/noticias"], [n.titulo, `/noticias/${n.slug}`]]),
        {
          "@type": "BlogPosting", headline: cortar(n.titulo, 110), description: descricao, datePublished: n.data || undefined,
          articleSection: n.tematica || undefined, inLanguage: "pt-PT", mainEntityOfPage: `${origem}/noticias/${n.slug}`,
          author: { "@id": `${origem}/#organizacao` }, publisher: { "@id": `${origem}/#organizacao` }, image: imagemArtigo,
        },
      ],
      corpo: `<article><h1>${esc(n.titulo)}</h1><p>${esc(cortar(texto, 600))}</p></article>`,
    });
  }
  if (caminho === "/empresas") {
    const titulo = comNome(limpar(seo.empresasTitulo) || "Formação para empresas");
    const descricao = limpar(seo.empresasDescricao) || `Formação à medida para equipas: diagnóstico, programa, formação certificada e acompanhamento, pela ${nome}.`;
    return base({ titulo, descricao, jsonLd: [migalhas(origem, [["Início", "/"], ["Empresas", "/empresas"]])], corpo: `<h1>${esc(titulo)}</h1><p>${esc(descricao)}</p>` });
  }
  if (caminho.startsWith("/empresas/")) {
    const slug = decodeURIComponent(caminho.slice("/empresas/".length).split("/")[0] ?? "").toLowerCase();
    const linha = (await servicosAtivos(db)).find(x => x.slug === slug);
    const s = linha ? { ...(linha.dados as { titulo: string; texto?: string; detalhe?: string; imagens?: { imagem: string }[] }) } : null;
    if (!s) return base({ estado: 404, titulo: comNome("Serviço não encontrado"), indexar: false, corpo: "<h1>Este serviço não existe.</h1><p><a href=\"/empresas\">Ver os serviços para empresas</a></p>" });
    const texto = limpar(s.detalhe || s.texto || "");
    const descricao = cortar(texto, 160);
    const imagem = s.imagens?.find(i => i.imagem)?.imagem;
    return base({
      titulo: comNome(s.titulo), descricao, imagem: imagem ? absoluto(origem, imagem) : imagemBase,
      jsonLd: [
        migalhas(origem, [["Início", "/"], ["Empresas", "/empresas"], [s.titulo, `/empresas/${slug}`]]),
        { "@type": "Service", name: s.titulo, description: descricao, provider: { "@id": `${origem}/#organizacao` }, url: `${origem}/empresas/${slug}` },
      ],
      corpo: `<h1>${esc(s.titulo)}</h1><p>${esc(cortar(texto, 600))}</p>`,
    });
  }
  if (caminho === "/area-formando" || caminho.startsWith("/area-formando/")) return privada("Área do formando");
  // Backoffice, ligações pessoais, assinaturas, verificação de documentos, pré-inscrição: não se indexam.
  return privada(nome);
}

/**
 * O HTML construído da aplicação (dist/app.html). Na Vercel vem incluído na função (vercel.json › includeFiles);
 * se não estiver, lê-se do próprio site (os ficheiros estáticos são servidos antes das reescritas, sem ciclo).
 */
let modelo: string | null = null;
export function definirModeloHtml(html: string | null) { modelo = html; }
export async function indexHtml(): Promise<string | null> {
  if (modelo) return modelo;
  const aqui = dirname(fileURLToPath(import.meta.url));
  // O build muda dist/index.html para dist/app.html (scripts/htmlDaApp.mjs); index.html fica para builds antigos.
  for (const nome of ["app.html", "index.html"]) {
    for (const p of [join(process.cwd(), "dist", nome), join(aqui, "..", "..", "dist", nome)]) {
      if (existsSync(p)) return (modelo = readFileSync(p, "utf8"));
    }
  }
  try {
    const r = await fetch(`${config.appOrigin}/app.html`, { signal: AbortSignal.timeout(4000) });
    const t = r.ok ? await r.text() : "";
    if (t.includes('<div id="root">')) return (modelo = t);
  } catch { /* sem modelo: quem chama serve o site sem as etiquetas */ }
  return null;
}

/** HTML final: as etiquetas no <head> e o conteúdo mínimo no #root. Sem o index.html construído, devolve null. */
export async function htmlDaPagina(db: Db, caminho: string, host?: string): Promise<{ estado: number; html: string } | null> {
  const doc = await indexHtml();
  if (!doc) return null;
  const m = await metaDaPagina(db, caminho, host);
  const seo = await lerSeo(db);
  const google = codigoVerificacao(seo.googleVerificacao);
  const bing = codigoVerificacao(seo.bingVerificacao);
  const robots = m.indexar ? "index, follow, max-image-preview:large, max-snippet:-1" : "noindex, nofollow";
  // Um só objeto com @graph (as páginas montam sempre um); «<» escapado para o JSON não fechar o <script>.
  const json = JSON.stringify(m.jsonLd.length === 1 ? m.jsonLd[0] : m.jsonLd).replace(/</g, "\\u003c");
  const cabeca = [
    `<title>${esc(m.titulo)}</title>`,
    `<meta name="description" content="${esc(m.descricao)}" />`,
    `<meta name="robots" content="${robots}" />`,
    m.indexar && m.estado === 200 ? `<link rel="canonical" href="${esc(m.canonico)}" />` : "",
    `<meta property="og:type" content="${m.tipo}" />`,
    `<meta property="og:site_name" content="${esc(m.titulo.split(" | ").pop() ?? m.titulo)}" />`,
    `<meta property="og:locale" content="pt_PT" />`,
    `<meta property="og:title" content="${esc(m.titulo)}" />`,
    `<meta property="og:description" content="${esc(m.descricao)}" />`,
    `<meta property="og:url" content="${esc(m.canonico)}" />`,
    `<meta property="og:image" content="${esc(m.imagem)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(m.titulo)}" />`,
    `<meta name="twitter:description" content="${esc(m.descricao)}" />`,
    `<meta name="twitter:image" content="${esc(m.imagem)}" />`,
    google ? `<meta name="google-site-verification" content="${esc(google)}" />` : "",
    bing ? `<meta name="msvalidate.01" content="${esc(bing)}" />` : "",
    `<script type="application/ld+json">${json}</script>`,
  ].filter(Boolean).join("\n    ");
  const html = doc
    .replace(/<html lang="[^"]*"/, "<html lang=\"pt-PT\"")
    .replace(/<title>[\s\S]*?<\/title>/, cabeca)
    // O mesmo texto da página, visualmente escondido até o React montar (sem «salto» visual, que a Google penaliza).
    .replace(/<div id="root"><\/div>/, `<div id="root"><div class="sr-only">${m.corpo}</div></div>`);
  return { estado: m.estado, html };
}

/** sitemap.xml: páginas, cursos publicados e notícias. Vazio quando a indexação está desligada. */
export async function sitemapXml(db: Db, host?: string) {
  const seo = await lerSeo(db);
  const origem = origemDo(seo);
  const urls: { loc: string; prioridade: string; mudanca: string; data?: string }[] = [];
  if (podeIndexar(seo, host)) {
    urls.push({ loc: `${origem}/`, prioridade: "1.0", mudanca: "weekly" }, { loc: `${origem}/formacao`, prioridade: "0.9", mudanca: "daily" });
    const { cursos } = await listarCatalogoPublico(db);
    for (const c of cursos) urls.push({ loc: `${origem}/formacao/${encodeURIComponent(c.id)}`, prioridade: "0.8", mudanca: "weekly" });
    urls.push({ loc: `${origem}/empresas`, prioridade: "0.6", mudanca: "monthly" }, { loc: `${origem}/noticias`, prioridade: "0.6", mudanca: "weekly" });
    for (const s of await servicosAtivos(db)) {
      urls.push({ loc: `${origem}/empresas/${encodeURIComponent(s.slug)}`, prioridade: "0.5", mudanca: "monthly" });
    }
    for (const n of await noticiasPublicas(db).catch(() => [])) {
      urls.push({ loc: `${origem}/noticias/${encodeURIComponent(n.slug)}`, prioridade: "0.5", mudanca: "monthly", data: /^\d{4}-\d{2}-\d{2}/.test(n.data) ? n.data.slice(0, 10) : undefined });
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u =>
    `  <url><loc>${esc(u.loc)}</loc>${u.data ? `<lastmod>${u.data}</lastmod>` : ""}<changefreq>${u.mudanca}</changefreq><priority>${u.prioridade}</priority></url>`).join("\n")}\n</urlset>\n`;
}

export async function robotsTxt(db: Db, host?: string) {
  const seo = await lerSeo(db);
  const origem = origemDo(seo);
  if (!podeIndexar(seo, host)) return "User-agent: *\nDisallow: /\n";
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "Disallow: /gesforma",
    "Disallow: /area-formando",
    "Disallow: /assinar",
    "Disallow: /verificar",
    "",
    `Sitemap: ${origem}/sitemap.xml`,
    "",
  ].join("\n");
}
