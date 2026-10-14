/**
 * PDF a partir do HTML do editor, com as mesmas medidas da página do editor e da impressão
 * (src/gesforma/vistas/crm/documento/documento.css): página de 640 px = 595,28 pt, margens 64/68 px,
 * Source Serif 4 a 14 px com entrelinha 1,6, títulos, listas, tabelas em Public Sans e quebras de página.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import fontkit from "@pdf-lib/fontkit";
import { rgb, type PDFDocument, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import { alinhamento, analisar, definicoesDe, type DefinicoesDoc, type No } from "./pdfHtmlParse.js";

export const A4: [number, number] = [595.28, 841.89];
/** pt por px da página do editor. */
export const S = A4[0] / 640;
export const M_TOPO = 64 * S;
export const M_LADO = 68 * S;
export const LARGURA = A4[0] - 2 * M_LADO;

const TINTA = rgb(0.094, 0.125, 0.173);
const SUAVE = rgb(0.353, 0.392, 0.455);
const FRACA = rgb(0.541, 0.576, 0.635);
const LINHA = rgb(0.886, 0.898, 0.918);

export type Fontes = { serif: [PDFFont, PDFFont, PDFFont, PDFFont]; sans: PDFFont; sansSemi: PDFFont; sansBold: PDFFont };

const PASTA = fileURLToPath(new URL("./fontes/", import.meta.url));
const cacheBytes = new Map<string, Buffer>();
function bytesFonte(nome: string) {
  let b = cacheBytes.get(nome);
  if (!b) {
    b = readFileSync(PASTA + nome);
    cacheBytes.set(nome, b);
  }
  return b;
}

/** Source Serif 4 (texto) e Public Sans (cabeçalho, tabelas, notas), as letras do editor. */
export async function embutirFontes(pdf: PDFDocument): Promise<Fontes> {
  pdf.registerFontkit(fontkit);
  const f = (n: string) => pdf.embedFont(bytesFonte(n), { subset: true });
  const [r, b, i, bi, sans, sansSemi, sansBold] = await Promise.all([
    f("SourceSerif4-Regular.ttf"), f("SourceSerif4-Bold.ttf"), f("SourceSerif4-Italic.ttf"), f("SourceSerif4-BoldItalic.ttf"),
    f("PublicSans-Regular.ttf"), f("PublicSans-SemiBold.ttf"), f("PublicSans-Bold.ttf"),
  ]);
  return { serif: [r, b, i, bi], sans, sansSemi, sansBold };
}

type Estilo = { b: boolean; i: boolean; u: boolean; s: boolean };
type Run = { texto: string; e: Estilo };
type Alinhar = "left" | "center" | "right" | "justify";
type Texto = { tipo: "texto"; runs: Run[]; sans: boolean; tam: number; lh: number; mt: number; mb: number; alinhar: Alinhar; recuo: number; marcador?: string; titulo?: boolean };
type Celula = { runs: Run[]; alinhar: Alinhar; th: boolean };
type Tabela = { tipo: "tabela"; linhas: Celula[][]; mt: number; mb: number };
type Bloco = Texto | Tabela | { tipo: "quebra" } | { tipo: "assinaturas"; colunas: string[]; mt: number };

const E0: Estilo = { b: false, i: false, u: false, s: false };
const el = (n: No): n is Extract<No, { tag: string }> => "tag" in n;

function runsDe(nos: No[], e: Estilo, out: Run[] = []): Run[] {
  for (const n of nos) {
    if (!el(n)) {
      out.push({ texto: n.texto.replace(/[ \t\r\n\f]+/g, " "), e });
      continue;
    }
    if (n.tag === "br") { out.push({ texto: "\n", e }); continue; }
    if (n.tag === "ul" || n.tag === "ol" || n.tag === "table") continue;
    const e2 = { ...e };
    if (n.tag === "strong" || n.tag === "b") e2.b = true;
    if (n.tag === "em" || n.tag === "i") e2.i = true;
    if (n.tag === "u") e2.u = true;
    if (n.tag === "s" || n.tag === "strike" || n.tag === "del") e2.s = true;
    runsDe(n.filhos, e2, out);
  }
  return out;
}

const INLINE = new Set(["strong", "b", "em", "i", "u", "s", "strike", "del", "span", "br", "a", "font", "sub", "sup"]);

/** Converte a árvore em blocos (parágrafos, títulos, itens de lista, tabelas, quebras). */
function blocosDe(nos: No[], ctx: { clausula: number; recuo: number }, out: Bloco[] = []): Bloco[] {
  let soltos: No[] = [];
  const despejar = () => {
    const runs = runsDe(soltos, E0);
    if (runs.some(r => r.texto.trim())) out.push(par(runs, "left", ctx.recuo));
    soltos = [];
  };
  for (const n of nos) {
    if (!el(n) || INLINE.has(n.tag)) { soltos.push(n); continue; }
    despejar();
    const a = n.attrs;
    if (a["data-gf"] === "doc") continue;
    if (n.tag === "p") out.push(par(runsDe(n.filhos, E0), alinhamento(a), ctx.recuo));
    else if (n.tag === "h2") out.push({ ...par(runsDe(n.filhos, { ...E0, b: true }), alinhamento(a), ctx.recuo), tam: 20, lh: 26, mt: 18, mb: 8, titulo: true });
    else if (n.tag === "h3") {
      const runs = runsDe(n.filhos, { ...E0, b: true });
      if ((a.class ?? "").split(/\s+/).includes("gf-clausula")) {
        ctx.clausula += 1;
        runs.unshift({ texto: `Cláusula ${ctx.clausula}.ª · `, e: { ...E0, b: true } });
      }
      out.push({ ...par(runs, alinhamento(a), ctx.recuo), tam: 15, lh: 21, mt: 16, mb: 6, titulo: true });
    } else if (n.tag === "ul" || n.tag === "ol") {
      const itens = n.filhos.filter(el).filter(f => f.tag === "li");
      const inicio = out.length;
      itens.forEach((li, k) => {
        const runs = runsDe(li.filhos, E0);
        out.push({ ...par(runs, alinhamento(li.attrs), ctx.recuo + 22), mb: 0, marcador: n.tag === "ol" ? `${k + 1}.` : "•" });
        const sub = li.filhos.filter(el).filter(f => f.tag === "ul" || f.tag === "ol");
        if (sub.length) blocosDe(sub, { ...ctx, recuo: ctx.recuo + 22 }, out);
      });
      const ultimo = out[out.length - 1];
      if (out.length > inicio && ultimo && ultimo.tipo === "texto") ultimo.mb = 10;
    } else if (n.tag === "table") out.push(tabelaDe(n));
    else if (a["data-quebra"] !== undefined) out.push({ tipo: "quebra" });
    else if (a["data-assinaturas"] !== undefined) {
      const colunas = n.filhos.filter(el).map(c => runsDe(c.filhos, E0).map(r => r.texto).join("").trim());
      out.push({ tipo: "assinaturas", colunas: colunas.length ? colunas : ["", ""], mt: 24 });
    } else if (n.tag === "section" && a["data-ligada"] === "0") continue;
    else blocosDe(n.filhos, ctx, out);
  }
  despejar();
  return out;
}

function par(runs: Run[], alinhar: Alinhar, recuo: number): Texto {
  return { tipo: "texto", runs, sans: false, tam: 14, lh: 22.4, mt: 0, mb: 10, alinhar, recuo };
}

function tabelaDe(t: Extract<No, { tag: string }>): Tabela {
  const linhas: Celula[][] = [];
  const visitar = (nos: No[]) => {
    for (const n of nos) {
      if (!el(n)) continue;
      if (n.tag === "tr") {
        linhas.push(n.filhos.filter(el).filter(c => c.tag === "td" || c.tag === "th").map(c => ({
          runs: runsDe(c.filhos, { ...E0, b: c.tag === "th" }), alinhar: alinhamento(c.attrs), th: c.tag === "th",
        })));
      } else visitar(n.filhos);
    }
  };
  visitar(t.filhos);
  return { tipo: "tabela", linhas, mt: 0, mb: 12 };
}

// ─── Linhas ──────────────────────────────────────────────────────────────────

type Peca = { texto: string; fonte: PDFFont; e: Estilo; w: number; espaco: number; quebra?: boolean };
type Linha = { pecas: Peca[]; w: number; forcada: boolean };

function fonteDe(f: Fontes, sans: boolean, e: Estilo) {
  if (sans) return e.b ? f.sansBold : f.sans;
  return f.serif[(e.b ? 1 : 0) + (e.i ? 2 : 0)]!;
}

function largura(fonte: PDFFont, t: string, tam: number) {
  try {
    return fonte.widthOfTextAtSize(t, tam);
  } catch {
    return t.length * tam * 0.5;
  }
}

/** Parte os runs em linhas que cabem em `max` (pt), como o browser faz (por palavras). */
function partir(runs: Run[], f: Fontes, sans: boolean, tamPt: number, max: number): Linha[] {
  const pecas: Peca[] = [];
  let texto = runs.map(r => r.texto).join("");
  const inicioVazio = texto.length - texto.trimStart().length;
  let consumido = 0;
  for (const r of runs) {
    const fonte = fonteDe(f, sans, r.e);
    const esp = largura(fonte, " ", tamPt);
    let t = r.texto;
    if (consumido < inicioVazio) {
      const corte = Math.min(t.length, inicioVazio - consumido);
      t = t.slice(corte);
      consumido += corte;
    }
    if (t === "\n") { pecas.push({ texto: "", fonte, e: r.e, w: 0, espaco: 0, quebra: true }); continue; }
    const partes = t.split(" ");
    partes.forEach((p, k) => {
      if (p) pecas.push({ texto: p, fonte, e: r.e, w: largura(fonte, p, tamPt), espaco: 0 });
      if (k < partes.length - 1 && pecas.length) pecas[pecas.length - 1]!.espaco = esp;
    });
  }
  texto = "";
  const linhas: Linha[] = [];
  let atual: Peca[] = [];
  let w = 0;
  const fechar = (forcada: boolean) => {
    const ult = atual[atual.length - 1];
    linhas.push({ pecas: atual, w: w - (ult?.espaco ?? 0), forcada });
    atual = [];
    w = 0;
  };
  for (const p of pecas) {
    if (p.quebra) { fechar(true); continue; }
    if (atual.length && w + p.w > max + 0.01) fechar(false);
    if (p.w > max) {
      // Palavra maior do que a linha (um hash, um endereço): parte-se aos bocados.
      let resto = p.texto;
      while (resto) {
        let n = resto.length;
        while (n > 1 && largura(p.fonte, resto.slice(0, n), tamPt) > max - w) n -= 1;
        atual.push({ ...p, texto: resto.slice(0, n), w: largura(p.fonte, resto.slice(0, n), tamPt), espaco: 0 });
        w += atual[atual.length - 1]!.w;
        resto = resto.slice(n);
        if (resto) fechar(false);
      }
      atual[atual.length - 1]!.espaco = p.espaco;
      w += p.espaco;
      continue;
    }
    atual.push(p);
    w += p.w + p.espaco;
  }
  if (atual.length || !linhas.length) fechar(true);
  // Espaços no fim de linha não contam.
  for (const l of linhas) while (l.pecas.length && !l.pecas[l.pecas.length - 1]!.texto && !l.pecas[l.pecas.length - 1]!.quebra) l.pecas.pop();
  return linhas;
}

function desenharLinha(pg: PDFPage, l: Linha, x0: number, max: number, base: number, tamPt: number, alinhar: Alinhar, cor: RGB) {
  let x = x0;
  let extra = 0;
  if (alinhar === "center") x += (max - l.w) / 2;
  else if (alinhar === "right") x += max - l.w;
  else if (alinhar === "justify" && !l.forcada && l.pecas.length > 1) extra = (max - l.w) / (l.pecas.length - 1);
  l.pecas.forEach((p, k) => {
    if (p.texto) pg.drawText(p.texto, { x, y: base, size: tamPt, font: p.fonte, color: cor });
    const fim = x + p.w + (k < l.pecas.length - 1 ? p.espaco + extra : 0);
    const segFim = x + p.w + (k < l.pecas.length - 1 && l.pecas[k + 1]!.e.u === p.e.u ? p.espaco + extra : 0);
    if (p.e.u) pg.drawLine({ start: { x, y: base - tamPt * 0.11 }, end: { x: segFim, y: base - tamPt * 0.11 }, thickness: Math.max(0.4, tamPt * 0.055), color: cor });
    if (p.e.s) pg.drawLine({ start: { x, y: base + tamPt * 0.28 }, end: { x: x + p.w, y: base + tamPt * 0.28 }, thickness: Math.max(0.4, tamPt * 0.055), color: cor });
    x = fim;
  });
}

/** Linha de base dentro da caixa de linha (o browser centra a altura da letra na entrelinha). */
function baseNaLinha(fonte: PDFFont, tamPt: number, lhPt: number, topo: number) {
  const asc = fonte.heightAtSize(tamPt, { descender: false });
  const alt = fonte.heightAtSize(tamPt);
  return topo - (lhPt - alt) / 2 - asc;
}

// ─── Páginas ─────────────────────────────────────────────────────────────────

export type Cabecalho = { entidade: string; logo?: { bytes: Buffer; mime: string } | null; meta: string[] };
export type ZonaAssinatura = { pagina: number; x: number; y: number; w: number; xEntidade: number };

export async function desenharDocumento(pdf: PDFDocument, f: Fontes, html: string, cab: Cabecalho) {
  const nos = analisar(html);
  const def = definicoesDe(nos);
  const blocos = blocosDe(nos, { clausula: 0, recuo: 0 });
  let pg = pdf.addPage(A4);
  let topo = await cabecalho(pdf, pg, f, cab, def);
  const fundo = M_TOPO;
  let pendente = 0;
  let zona: ZonaAssinatura | null = null;
  const novaPagina = () => { pg = pdf.addPage(A4); topo = A4[1] - M_TOPO; pendente = 0; };
  const cabe = (h: number) => topo - h >= fundo - 0.5;

  for (let i = 0; i < blocos.length; i++) {
    const b = blocos[i]!;
    if (b.tipo === "quebra") { novaPagina(); continue; }
    const margem = Math.max(pendente, b.mt) * S;
    const noTopo = topo >= A4[1] - M_TOPO - 0.5;
    if (b.tipo === "assinaturas") {
      const h = (96 + 6 + 18 + 40) * S;
      if (!noTopo) topo -= b.mt * S;
      if (!cabe(h)) novaPagina();
      const gap = 40 * S;
      const w = (LARGURA - gap) / 2;
      const linhaY = topo - 96 * S;
      b.colunas.slice(0, 2).forEach((c, k) => {
        const x = M_LADO + k * (w + gap);
        pg.drawLine({ start: { x, y: linhaY }, end: { x: x + w, y: linhaY }, thickness: 0.75, color: TINTA });
        pg.drawText(c, { x, y: linhaY - 6 * S - 12 * S, size: 12 * S, font: f.sans, color: SUAVE });
      });
      zona = { pagina: pdf.getPageCount() - 1, x: M_LADO + w + gap, y: linhaY, w, xEntidade: M_LADO };
      topo -= h;
      pendente = 0;
      continue;
    }
    if (b.tipo === "tabela") {
      if (!noTopo) topo -= margem;
      desenharTabela(b);
      pendente = b.mb;
      continue;
    }
    const tamPt = b.tam * S;
    const lhPt = b.lh * S;
    const x0 = M_LADO + b.recuo * S;
    const max = LARGURA - b.recuo * S;
    const linhas = partir(b.runs, f, b.sans, tamPt, max);
    if (!noTopo) topo -= margem;
    // Um título não fica sozinho no fundo da página: leva consigo a primeira linha do bloco seguinte.
    const seguinte = blocos[i + 1];
    const extra = b.titulo && seguinte?.tipo === "texto" ? (Math.max(b.mb, seguinte.mt) + seguinte.lh * 2) * S : 0;
    if (!cabe(lhPt * Math.min(linhas.length, b.titulo ? linhas.length : 2) + extra) && !noTopo) novaPagina();
    linhas.forEach((l, k) => {
      if (!cabe(lhPt)) novaPagina();
      const fonte = l.pecas[0]?.fonte ?? fonteDe(f, b.sans, E0);
      const base = baseNaLinha(fonte, tamPt, lhPt, topo);
      if (k === 0 && b.marcador) {
        const mf = fonteDe(f, b.sans, E0);
        const mw = largura(mf, b.marcador, tamPt);
        pg.drawText(b.marcador, { x: x0 - (b.marcador === "•" ? 14 * S : mw + 6 * S), y: base, size: tamPt, font: mf, color: TINTA });
      }
      desenharLinha(pg, l, x0, max, base, tamPt, b.alinhar, TINTA);
      topo -= lhPt;
    });
    pendente = b.mb;
  }
  return { zona };

  function desenharTabela(t: Tabela) {
    const cols = Math.max(1, ...t.linhas.map(l => l.length));
    const tam = 13 * S;
    const lh = 13 * 1.4 * S;
    const pad = 6 * S;
    const gap = 12 * S;
    // Duas colunas (descrição | valor): a última fica com a largura do conteúdo, como no browser.
    let larguras = Array.from({ length: cols }, () => (LARGURA - gap * (cols - 1)) / cols);
    if (cols === 2) {
      const natural = Math.max(...t.linhas.map(l => (l[1] ? partir(l[1].runs, f, true, tam, LARGURA).reduce((m, x) => Math.max(m, x.w), 0) : 0)));
      const w2 = Math.min(Math.max(natural, 40 * S), LARGURA / 2);
      larguras = [LARGURA - gap - w2, w2];
    }
    for (const linha of t.linhas) {
      const partidas = linha.map((c, k) => partir(c.runs, f, true, tam, larguras[k] ?? larguras[0]!));
      const h = Math.max(1, ...partidas.map(p => p.length)) * lh + 2 * pad;
      if (!cabe(h)) novaPagina();
      let x = M_LADO;
      linha.forEach((c, k) => {
        const w = larguras[k] ?? larguras[0]!;
        let y = topo - pad;
        for (const l of partidas[k]!) {
          const fonte = l.pecas[0]?.fonte ?? f.sans;
          desenharLinha(pg, l, x, w, baseNaLinha(fonte, tam, lh, y), tam, c.alinhar, TINTA);
          y -= lh;
        }
        x += w + gap;
      });
      topo -= h;
      pg.drawLine({ start: { x: M_LADO, y: topo }, end: { x: A4[0] - M_LADO, y: topo }, thickness: 0.75, color: LINHA });
    }
  }
}

async function cabecalho(pdf: PDFDocument, pg: PDFPage, f: Fontes, c: Cabecalho, def: DefinicoesDoc) {
  const topo = A4[1] - M_TOPO;
  const tamNome = 12 * S;
  const tamSub = 11 * S;
  const lhNome = 12 * 1.35 * S;
  const lhSub = 11 * 1.35 * S;
  let img: Awaited<ReturnType<PDFDocument["embedPng"]>> | null = null;
  if (c.logo?.bytes.length) {
    try {
      img = c.logo.mime === "image/png" ? await pdf.embedPng(c.logo.bytes) : await pdf.embedJpg(c.logo.bytes);
    } catch {
      img = null;
    }
  }
  const hLogo = def.logoAltura * S;
  const wLogo = img ? Math.min((img.width / img.height) * hLogo, 220 * S) : 0;
  const hLogoReal = img ? wLogo / (img.width / img.height) : 0;
  const nome = def.mostrarNome ? c.entidade : "";
  const sub = def.mostrarNome ? def.subtitulo : "";
  const wNome = nome ? largura(f.sansBold, nome, tamNome) : 0;
  const wSub = sub ? largura(f.sans, sub, tamSub) : 0;
  const wMarca = Math.max(wLogo, wNome, wSub);
  const hMarca = (img ? hLogoReal : 0) + (nome ? 6 * S + lhNome : 0) + (sub ? 2 * S + lhSub : 0);
  const lhMeta = 11 * 1.35 * S;
  const hMeta = c.meta.length * lhMeta;

  const marca = (xEsq: number, alinhar: "left" | "center" | "right", y0: number) => {
    let y = y0;
    const xDe = (w: number) => (alinhar === "left" ? xEsq : alinhar === "right" ? xEsq + wMarca - w : xEsq + (wMarca - w) / 2);
    if (img) {
      pg.drawImage(img, { x: xDe(wLogo), y: y - hLogoReal, width: wLogo, height: hLogoReal });
      y -= hLogoReal;
    }
    if (nome) {
      y -= 6 * S;
      pg.drawText(nome, { x: xDe(wNome), y: baseNaLinha(f.sansBold, tamNome, lhNome, y), size: tamNome, font: f.sansBold, color: TINTA });
      y -= lhNome;
    }
    if (sub) {
      y -= 2 * S;
      pg.drawText(sub, { x: xDe(wSub), y: baseNaLinha(f.sans, tamSub, lhSub, y), size: tamSub, font: f.sans, color: SUAVE });
    }
  };
  const meta = (x: number, alinhar: "left" | "center" | "right", y0: number) => {
    c.meta.forEach((m, k) => {
      const w = largura(f.sans, m, tamSub);
      const xx = alinhar === "left" ? x : alinhar === "right" ? x - w : x - w / 2;
      pg.drawText(m, { x: xx, y: baseNaLinha(f.sans, tamSub, lhMeta, y0 - k * lhMeta), size: tamSub, font: f.sans, color: SUAVE });
    });
  };
  let altura: number;
  if (def.logoPos === "centro") {
    marca(A4[0] / 2 - wMarca / 2, "center", topo);
    meta(A4[0] / 2, "center", topo - hMarca - 12 * S);
    altura = hMarca + (c.meta.length ? 12 * S + hMeta : 0);
  } else if (def.logoPos === "direita") {
    marca(A4[0] - M_LADO - wMarca, "right", topo);
    meta(M_LADO, "left", topo);
    altura = Math.max(hMarca, hMeta);
  } else {
    marca(M_LADO, "left", topo);
    meta(A4[0] - M_LADO, "right", topo);
    altura = Math.max(hMarca, hMeta);
  }
  return topo - altura - 28 * S;
}

/** "Página x de y" à direita, como na impressão do editor (com a referência à esquerda, quando há). */
export function rodapes(pdf: PDFDocument, f: Fontes, referencia = "") {
  const total = pdf.getPageCount();
  pdf.getPages().forEach((p, i) => {
    const t = `Página ${i + 1} de ${total}`;
    const tam = 7;
    p.drawText(t, { x: A4[0] - M_LADO - largura(f.sans, t, tam), y: 28, size: tam, font: f.sans, color: FRACA });
    if (referencia) p.drawText(referencia.slice(0, 110), { x: M_LADO, y: 28, size: tam, font: f.sans, color: FRACA });
  });
}
