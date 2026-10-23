/**
 * PDF dos contratos para assinatura: o original (gerado ao enviar, igual à página do editor),
 * a assinatura no espaço "Pela … / Pelo …" do documento, a página "Certificado de assinatura" e o selo da entidade.
 */
import { createHash } from "node:crypto";
import { fmtDataDDMMAAAA } from "../../../src/partilhado/horaLisboa.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { A4, M_LADO, M_TOPO, S, desenharDocumento, embutirFontes, rodapes, type Fontes, type ZonaAssinatura } from "./pdfHtml.js";
import { eHtml, escaparHtml as escapar } from "./pdfHtmlParse.js";

export const sha256 = (b: Buffer | Uint8Array) => createHash("sha256").update(b).digest("hex");

const TINTA = rgb(0.094, 0.125, 0.173);
const SUAVE = rgb(0.353, 0.392, 0.455);
const LINHA = rgb(0.886, 0.898, 0.918);
const ACAO = rgb(1, 0.69, 0.125);

export type Cabecalho = { entidade: string; linhaEntidade: string; logo?: { bytes: Buffer; mime: string } | null };

const MARCA_ZONA = "gf-assinatura:";

/** Sem logótipo carregado, o editor mostra o logótipo do site (o servidor redirige para ele): o PDF usa o mesmo. */
let logoPredefinido: Buffer | null | undefined;
function logoDoSite() {
  if (logoPredefinido === undefined) {
    try {
      logoPredefinido = readFileSync(fileURLToPath(new URL("./fontes/logo-predefinido.png", import.meta.url)));
    } catch {
      logoPredefinido = null;
    }
  }
  return logoPredefinido ? { bytes: logoPredefinido, mime: "image/png" } : null;
}

/** Texto simples antigo → parágrafos (o mesmo que o editor faz ao abrir um texto sem HTML). */
function textoParaHtml(t: string) {
  return t.replace(/\r/g, "").split(/\n{2,}/).map(p => p.trim()).filter(Boolean).map(p => `<p>${escapar(p).replace(/\n/g, "<br>")}</p>`).join("");
}

/** Data do documento em dd-mm-aaaa (hora de Lisboa). */
function dataLonga(d = new Date()) {
  return fmtDataDDMMAAAA(d);
}

/** Documento original: a página do editor (cabeçalho, texto, cláusulas) e o espaço das assinaturas. */
export async function gerarPdfContrato(opts: { titulo: string; texto: string; cabecalho: Cabecalho; referencia: string; signatario?: string }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.titulo);
  pdf.setAuthor(opts.cabecalho.entidade);
  pdf.setProducer("GesForma");
  pdf.setCreator("GesForma");
  const f = await embutirFontes(pdf);
  let html = eHtml(opts.texto) ? opts.texto : `<h2>${escapar(opts.titulo)}</h2>${textoParaHtml(opts.texto)}`;
  // Sem o bloco de assinaturas no texto, acrescenta-se no fim (é aí que a assinatura é desenhada).
  if (!/data-assinaturas/.test(html)) {
    html += `<div data-assinaturas="1"><div>Pela ${escapar(opts.cabecalho.entidade)}</div><div>${escapar(opts.signatario || "O signatário")}</div></div>`;
  }
  const n = /n\.º\s*(\d+)/.exec(opts.referencia)?.[1];
  const meta = [n ? `Contrato C-${n.padStart(4, "0")}` : opts.titulo.slice(0, 60), dataLonga()];
  const logo = opts.cabecalho.logo ?? logoDoSite();
  const { zona } = await desenharDocumento(pdf, f, html, { entidade: opts.cabecalho.entidade, logo, meta });
  if (zona) pdf.setKeywords([`${MARCA_ZONA}${[zona.pagina, zona.x, zona.y, zona.w, zona.xEntidade].map(v => v.toFixed(2)).join(":")}`]);
  rodapes(pdf, f, opts.referencia);
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

function zonaDe(pdf: PDFDocument): ZonaAssinatura | null {
  const k = (pdf.getKeywords() ?? "").split(/\s+/).find(x => x.startsWith(MARCA_ZONA));
  if (!k) return null;
  const [pagina, x, y, w, xEntidade] = k.slice(MARCA_ZONA.length).split(":").map(Number);
  if ([pagina, x, y, w, xEntidade].some(v => !Number.isFinite(v))) return null;
  return { pagina: pagina!, x: x!, y: y!, w: w!, xEntidade: xEntidade! };
}

function cortar(t: string, fonte: PDFFont, tam: number, max: number) {
  let s = t;
  while (s.length > 1 && fonte.widthOfTextAtSize(s, tam) > max) s = s.slice(0, -1);
  return s === t ? s : `${s.slice(0, -1)}…`;
}

export type DadosAssinatura = {
  nome: string; nif: string; data: string; codigo: string;
  metodo: "desenhada" | "escrita"; imagemPng?: Buffer | null; textoEscrito?: string;
};

/** Desenha a assinatura no espaço do signatário (por cima da linha) e o selo da entidade do lado esquerdo. */
export async function carimbarAssinatura(original: Buffer, d: DadosAssinatura) {
  const pdf = await PDFDocument.load(original);
  const f = await embutirFontes(pdf);
  const zona = zonaDe(pdf) ?? { pagina: pdf.getPageCount() - 1, x: A4[0] / 2 + 10, y: 150, w: A4[0] / 2 - M_LADO - 10, xEntidade: M_LADO };
  const pg = pdf.getPage(Math.min(zona.pagina, pdf.getPageCount() - 1));
  const alto = 96 * S - 8;
  // Caixa da assinatura, por cima da linha "Pelo …".
  pg.drawRectangle({ x: zona.x, y: zona.y + 4, width: zona.w, height: alto, color: rgb(1, 0.985, 0.95), borderColor: ACAO, borderWidth: 0.8 });
  if (d.metodo === "desenhada" && d.imagemPng?.length) {
    const img = await pdf.embedPng(d.imagemPng);
    const escala = Math.min((zona.w - 16) / img.width, (alto - 30) / img.height);
    pg.drawImage(img, { x: zona.x + (zona.w - img.width * escala) / 2, y: zona.y + 24, width: img.width * escala, height: img.height * escala });
  } else {
    const t = cortar(d.textoEscrito || d.nome, f.serif[2], 20, zona.w - 16);
    pg.drawText(t, { x: zona.x + (zona.w - f.serif[2].widthOfTextAtSize(t, 20)) / 2, y: zona.y + 34, size: 20, font: f.serif[2], color: TINTA });
  }
  pg.drawText(cortar(`${d.nome} · NIF ${d.nif || "não indicado"}`, f.sansSemi, 7, zona.w - 16), { x: zona.x + 8, y: zona.y + 12, size: 7, font: f.sansSemi, color: TINTA });
  // Por baixo da legenda: quando e como.
  const linhas = [
    [f.sansBold, "Assinado eletronicamente"],
    [f.sans, `${d.data} · código por email confirmado`],
    [f.sans, `Verificação ${d.codigo}`],
  ] as const;
  let y = zona.y - 6 * S - 12 * S - 13;
  for (const [fonte, t] of linhas) {
    pg.drawText(cortar(t, fonte, 7, zona.w), { x: zona.x, y, size: 7, font: fonte, color: TINTA });
    y -= 9;
  }
  // Lado da entidade: o selo digital é aplicado depois desta página (assinatura PDF da entidade).
  const entidade = pdf.getAuthor() || "a entidade formadora";
  const yE = zona.y + 40;
  pg.drawText(cortar("Selo digital da entidade", f.sansBold, 8, zona.w), { x: zona.xEntidade + 8, y: yE, size: 8, font: f.sansBold, color: TINTA });
  pg.drawText(cortar(`Aplicado por ${entidade}`, f.sans, 7, zona.w - 16), { x: zona.xEntidade + 8, y: yE - 11, size: 7, font: f.sans, color: SUAVE });
  pg.drawText(cortar(`${d.data} · ver certificado na última página`, f.sans, 7, zona.w - 16), { x: zona.xEntidade + 8, y: yE - 21, size: 7, font: f.sans, color: SUAVE });
  const bytes = Buffer.from(await pdf.save({ useObjectStreams: false }));
  return { pdf: bytes, hash: sha256(bytes) };
}

export type DadosCertificado = {
  titulo: string; codigo: string; urlVerificacao: string; entidade: string;
  signatario: { nome: string; nif: string; email: string };
  metodo: string; hashOriginal: string; hashAssinatura: string;
  selo: { titular: string; emissor: string; fingerprint: string; autoAssinado: boolean } | null;
  eventos: { quando: string; texto: string }[];
};

/** Página "Certificado de assinatura": documento, assinaturas, selo, registo de provas e QR de verificação. */
export async function acrescentarCertificado(pdfAssinado: Buffer, d: DadosCertificado) {
  const pdf = await PDFDocument.load(pdfAssinado);
  const f = await embutirFontes(pdf);
  const total = pdf.getPageCount() + 1;
  const pg = pdf.addPage(A4);
  const largura = A4[0] - 2 * M_LADO;
  let y = A4[1] - M_TOPO;
  const texto = (t: string, x: number, yy: number, tam: number, fonte: PDFFont = f.sans, cor = TINTA) => pg.drawText(t, { x, y: yy, size: tam, font: fonte, color: cor });
  const paragrafo = (t: string, tam = 8.5, fonte: PDFFont = f.sans, cor = SUAVE, max = largura) => {
    for (const l of quebrar(t, fonte, tam, max)) { texto(l, M_LADO, y, tam, fonte, cor); y -= tam * 1.45; }
  };
  texto(`${d.titulo.slice(0, 70)} · página ${total} de ${total}`, M_LADO, y, 7.5, f.sans, SUAVE);
  y -= 26;
  texto("Certificado de assinatura", M_LADO, y, 17, f.sansBold);
  y -= 16;
  paragrafo("Gerado pelo GesForma e incluído no PDF antes do selo final da entidade. Qualquer alteração ao documento invalida o selo.", 8.5, f.sans, SUAVE, largura - 110);

  const qr = await QRCode.toBuffer(d.urlVerificacao, { type: "png", margin: 1, width: 240, errorCorrectionLevel: "M" });
  pg.drawImage(await pdf.embedPng(qr), { x: A4[0] - M_LADO - 88, y: A4[1] - M_TOPO - 104, width: 88, height: 88 });
  y = Math.min(y, A4[1] - M_TOPO - 112);

  const seccao = (t: string) => {
    y -= 10;
    texto(t, M_LADO, y, 10.5, f.sansBold);
    y -= 6;
    pg.drawLine({ start: { x: M_LADO, y }, end: { x: A4[0] - M_LADO, y }, thickness: 0.6, color: LINHA });
    y -= 13;
  };
  const campo = (rotulo: string, valor: string, mono = false) => {
    texto(rotulo, M_LADO, y, 7.5, f.sans, SUAVE);
    const fonte = mono ? f.sansSemi : f.sans;
    const tam = mono ? 7 : 8.5;
    for (const l of quebrar(valor, fonte, tam, largura - 150)) { texto(l, M_LADO + 150, y, tam, fonte); y -= tam + 4; }
    y -= 3;
  };

  seccao("Documento");
  campo("Título", d.titulo);
  campo("Entidade", d.entidade);
  campo("SHA-256 do documento enviado", d.hashOriginal, true);
  campo("SHA-256 após a assinatura", d.hashAssinatura, true);
  campo("Código de verificação", d.codigo);

  seccao("Assinaturas");
  const cols = [M_LADO, M_LADO + 150, M_LADO + 230, M_LADO + 320];
  ["Quem", "NIF", "Quando", "Como"].forEach((h, k) => texto(h, cols[k]!, y, 7.5, f.sansSemi, SUAVE));
  y -= 12;
  const ultimo = d.eventos[d.eventos.length - 1]?.quando ?? "";
  const linha = [d.signatario.nome, d.signatario.nif || "não indicado", ultimo, `${d.metodo} · código por email`];
  linha.forEach((t, k) => texto(cortar(t, f.sans, 8, (cols[k + 1] ?? A4[0] - M_LADO) - cols[k]! - 6), cols[k]!, y, 8));
  y -= 8;
  pg.drawLine({ start: { x: M_LADO, y }, end: { x: A4[0] - M_LADO, y }, thickness: 0.5, color: LINHA });
  y -= 12;
  texto(cortar(`Email: ${d.signatario.email}`, f.sans, 7.5, largura), M_LADO, y, 7.5, f.sans, SUAVE);
  y -= 14;

  seccao("Selo digital da entidade");
  if (d.selo) {
    campo("Formato", "Assinatura digital PDF (PKCS#7 destacada, SHA-256)");
    campo("Titular do certificado", d.selo.titular);
    campo("Emitido por", d.selo.autoAssinado ? `${d.selo.emissor} (auto-assinado)` : d.selo.emissor);
    campo("Impressão digital (SHA-256)", d.selo.fingerprint, true);
    if (d.selo.autoAssinado) campo("Nota", "Certificado próprio da entidade, fora da lista de confiança da Adobe: o leitor de PDF pode mostrar a assinatura como não verificada.");
  } else {
    campo("Sem selo", "A entidade ainda não configurou um certificado de selo. A integridade confirma-se pelo SHA-256 e pelo registo de provas.");
  }

  seccao("Registo de provas");
  for (const e of d.eventos.slice(-14)) {
    if (y < M_TOPO + 60) break;
    campo(e.quando, e.texto);
  }
  y = Math.max(y - 4, M_TOPO + 24);
  paragrafo(`Para confirmar a autenticidade, abra ${d.urlVerificacao} (ou o código QR) e carregue este PDF: o GesForma compara a impressão digital com a que guardou no momento da assinatura.`);
  texto("Assinatura eletrónica com código de confirmação enviado por email e registo de provas (eIDAS, art.º 25.º, n.º 1).", M_LADO, 28, 7, f.sans, SUAVE);
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

function quebrar(t: string, fonte: PDFFont, tam: number, max: number) {
  const linhas: string[] = [];
  let atual = "";
  for (const p of t.split(/\s+/)) {
    const tent = atual ? `${atual} ${p}` : p;
    if (fonte.widthOfTextAtSize(tent, tam) <= max) { atual = tent; continue; }
    if (atual) linhas.push(atual);
    let resto = p;
    while (fonte.widthOfTextAtSize(resto, tam) > max && resto.length > 1) {
      let n = resto.length;
      while (n > 1 && fonte.widthOfTextAtSize(resto.slice(0, n), tam) > max) n -= 1;
      linhas.push(resto.slice(0, n));
      resto = resto.slice(n);
    }
    atual = resto;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export type { Fontes, PDFPage };
