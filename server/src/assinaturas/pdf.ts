/**
 * PDF dos contratos para assinatura: o original (gerado ao enviar), a assinatura no fim do documento,
 * a página "Certificado de assinatura" e o selo da entidade (assinatura digital PDF, PKCS#7 destacada).
 */
import { createHash } from "node:crypto";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { larguraSegura, linhasDe, rodapes, A4, MARGEM, ZONA_ASSINATURA } from "./pdfTexto.js";

export const sha256 = (b: Buffer | Uint8Array) => createHash("sha256").update(b).digest("hex");

const TINTA = rgb(0.094, 0.125, 0.173);
const SUAVE = rgb(0.353, 0.392, 0.455);
const LINHA = rgb(0.886, 0.898, 0.918);

export type Cabecalho = { entidade: string; linhaEntidade: string; logo?: { bytes: Buffer; mime: string } | null };

/** Documento original: cabeçalho da entidade, título, texto e espaço reservado para a assinatura na última página. */
export async function gerarPdfContrato(opts: { titulo: string; texto: string; cabecalho: Cabecalho; referencia: string }) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(opts.titulo);
  pdf.setAuthor(opts.cabecalho.entidade);
  pdf.setProducer("GesForma");
  pdf.setCreator("GesForma");
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const largura = A4[0] - 2 * MARGEM;

  let pagina = pdf.addPage(A4);
  let y = await cabecalho(pdf, pagina, opts.cabecalho, fonte, negrito);
  y -= 8;
  for (const l of linhasDe(larguraSegura(opts.titulo, negrito), negrito, 15, largura)) {
    pagina.drawText(l, { x: MARGEM, y, size: 15, font: negrito, color: TINTA });
    y -= 20;
  }
  y -= 8;

  const paragrafos = opts.texto.replace(/\r/g, "").split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  for (const p of paragrafos) {
    const linhas = p.split("\n").flatMap(l => linhasDe(larguraSegura(l, fonte), fonte, 10.5, largura));
    for (const l of linhas) {
      if (y < MARGEM + 30) {
        pagina = pdf.addPage(A4);
        y = A4[1] - MARGEM;
      }
      pagina.drawText(l, { x: MARGEM, y, size: 10.5, font: fonte, color: TINTA, lineHeight: 15 });
      y -= 15;
    }
    y -= 8;
  }
  // A assinatura entra no fundo da última página; se não houver espaço, abre-se mais uma.
  if (y < ZONA_ASSINATURA.topo + 20) pagina = pdf.addPage(A4);
  pagina.drawLine({ start: { x: MARGEM, y: ZONA_ASSINATURA.topo + 6 }, end: { x: A4[0] - MARGEM, y: ZONA_ASSINATURA.topo + 6 }, thickness: 0.5, color: LINHA });
  pagina.drawText("Assinatura", { x: MARGEM, y: ZONA_ASSINATURA.topo - 8, size: 8, font: negrito, color: SUAVE });

  rodapes(pdf, fonte, `${opts.cabecalho.entidade} · ${opts.referencia}`);
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}

async function cabecalho(pdf: PDFDocument, pagina: PDFPage, c: Cabecalho, fonte: PDFFont, negrito: PDFFont) {
  let y = A4[1] - MARGEM;
  if (c.logo?.bytes.length) {
    try {
      const img = c.logo.mime === "image/png" ? await pdf.embedPng(c.logo.bytes) : await pdf.embedJpg(c.logo.bytes);
      const h = 38;
      const w = Math.min((img.width / img.height) * h, 180);
      const altura = w / (img.width / img.height);
      pagina.drawImage(img, { x: MARGEM, y: y - altura, width: w, height: altura });
      y -= h + 8;
    } catch {
      // logótipo ilegível: fica só o nome
    }
  }
  pagina.drawText(larguraSegura(c.entidade, negrito), { x: MARGEM, y: y - 10, size: 10, font: negrito, color: TINTA });
  y -= 24;
  if (c.linhaEntidade) {
    pagina.drawText(larguraSegura(c.linhaEntidade, fonte).slice(0, 120), { x: MARGEM, y: y + 2, size: 8, font: fonte, color: SUAVE });
    y -= 12;
  }
  pagina.drawLine({ start: { x: MARGEM, y }, end: { x: A4[0] - MARGEM, y }, thickness: 0.6, color: LINHA });
  return y - 22;
}

export type DadosAssinatura = {
  nome: string; nif: string; data: string; codigo: string;
  metodo: "desenhada" | "escrita"; imagemPng?: Buffer | null; textoEscrito?: string;
};

/** Desenha a assinatura no espaço reservado da última página. Devolve o PDF e o seu SHA-256. */
export async function carimbarAssinatura(original: Buffer, d: DadosAssinatura) {
  const pdf = await PDFDocument.load(original);
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italico = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const pagina = pdf.getPage(pdf.getPageCount() - 1);
  const x = MARGEM;
  const topo = ZONA_ASSINATURA.topo - 16;
  const caixa = { w: 250, h: 92 };
  pagina.drawRectangle({ x, y: topo - caixa.h, width: caixa.w, height: caixa.h, borderColor: rgb(1, 0.69, 0.125), borderWidth: 1, color: rgb(1, 0.985, 0.95) });
  if (d.metodo === "desenhada" && d.imagemPng?.length) {
    const img = await pdf.embedPng(d.imagemPng);
    const escala = Math.min((caixa.w - 20) / img.width, 40 / img.height);
    pagina.drawImage(img, { x: x + 10, y: topo - 48, width: img.width * escala, height: img.height * escala });
  } else {
    pagina.drawText(larguraSegura(d.textoEscrito || d.nome, italico).slice(0, 40), { x: x + 10, y: topo - 34, size: 18, font: italico, color: TINTA });
  }
  const linhas = [
    [negrito, `Assinado eletronicamente por ${d.nome}`],
    [fonte, `NIF ${d.nif || "não indicado"} · ${d.data}`],
    [fonte, `Código de verificação ${d.codigo}`],
  ] as const;
  let y = topo - 60;
  for (const [f, t] of linhas) {
    pagina.drawText(larguraSegura(t, f).slice(0, 70), { x: x + 10, y, size: 7.5, font: f, color: TINTA });
    y -= 10;
  }
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

/** Acrescenta a página "Certificado de assinatura" com as provas, os hashes e o QR de verificação. */
export async function acrescentarCertificado(pdfAssinado: Buffer, d: DadosCertificado) {
  const pdf = await PDFDocument.load(pdfAssinado);
  const fonte = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const mono = await pdf.embedFont(StandardFonts.Courier);
  const pagina = pdf.addPage(A4);
  const largura = A4[0] - 2 * MARGEM;
  let y = A4[1] - MARGEM;
  pagina.drawText("Certificado de assinatura", { x: MARGEM, y, size: 16, font: negrito, color: TINTA });
  y -= 18;
  pagina.drawText(larguraSegura(`${d.titulo} · ${d.entidade}`, fonte).slice(0, 95), { x: MARGEM, y, size: 9, font: fonte, color: SUAVE });

  const qr = await QRCode.toBuffer(d.urlVerificacao, { type: "png", margin: 1, width: 220, errorCorrectionLevel: "M" });
  const qrImg = await pdf.embedPng(qr);
  pagina.drawImage(qrImg, { x: A4[0] - MARGEM - 92, y: y - 86, width: 92, height: 92 });
  y -= 28;

  const seccao = (titulo: string) => {
    y -= 6;
    pagina.drawText(titulo, { x: MARGEM, y, size: 10, font: negrito, color: TINTA });
    y -= 14;
  };
  const campo = (rotulo: string, valor: string, f: PDFFont = fonte, tam = 9) => {
    pagina.drawText(rotulo, { x: MARGEM, y, size: 8, font: fonte, color: SUAVE });
    const linhas = linhasDe(larguraSegura(valor, f), f, tam, largura - 120 - (y > A4[1] - 180 ? 100 : 0));
    for (const l of linhas) {
      pagina.drawText(l, { x: MARGEM + 120, y, size: tam, font: f, color: TINTA });
      y -= tam + 4;
    }
    y -= 2;
  };

  seccao("Documento");
  campo("Código de verificação", d.codigo, negrito);
  campo("Verificar em", d.urlVerificacao);
  seccao("Signatário");
  campo("Nome", d.signatario.nome);
  campo("NIF", d.signatario.nif || "não indicado");
  campo("Email", d.signatario.email);
  campo("Método", d.metodo);
  seccao("Integridade (SHA-256)");
  campo("Documento original", d.hashOriginal, mono, 7.5);
  campo("Com a assinatura", d.hashAssinatura, mono, 7.5);
  pagina.drawText(
    larguraSegura("O SHA-256 do ficheiro final (com esta página e o selo) fica no registo e na página de verificação.", fonte),
    { x: MARGEM, y, size: 7.5, font: fonte, color: SUAVE },
  );
  y -= 14;
  seccao("Selo da entidade");
  if (d.selo) {
    campo("Titular", d.selo.titular);
    campo("Emitido por", d.selo.autoAssinado ? `${d.selo.emissor} (auto-assinado)` : d.selo.emissor);
    campo("Impressão digital", d.selo.fingerprint, mono, 7);
    if (d.selo.autoAssinado) {
      campo("Nota", "Certificado próprio da entidade, fora da lista de confiança da Adobe: o leitor de PDF pode mostrar a assinatura como não verificada.");
    }
  } else {
    campo("Sem selo", "A entidade ainda não configurou um certificado de selo. A integridade confirma-se pelo SHA-256 e pelo registo.");
  }
  seccao("Registo de provas");
  for (const e of d.eventos.slice(0, 16)) {
    if (y < MARGEM + 40) break;
    campo(e.quando, e.texto);
  }
  y = Math.max(y, MARGEM + 30);
  pagina.drawText(
    larguraSegura("Assinatura eletrónica simples com código de confirmação enviado por email e registo de provas (eIDAS, art.º 25.º, n.º 1).", fonte),
    { x: MARGEM, y: MARGEM + 10, size: 7, font: fonte, color: SUAVE },
  );
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
