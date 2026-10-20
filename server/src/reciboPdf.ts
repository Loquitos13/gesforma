import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

/** Recibo interno de pagamento em PDF (A4). Não é uma fatura e di-lo no próprio documento. */

export type DadosRecibo = {
  numero: string;
  emitidoEm: string;
  entidade: { nome: string; nif: string; morada: string; codigoPostal: string; localidade: string; email: string; telefone: string; iban: string; titularConta: string };
  pagador: { nome: string; nif: string; email: string; morada: string };
  /** Formando, quando o recibo é passado a outra pessoa ou à empresa (dados de faturação). */
  formando?: string;
  curso: string;
  turma: string;
  valor: number;
  metodo: string;
  data: string;
  confirmadoPor: string;
  referencia: string;
};

const TINTA = rgb(0.094, 0.125, 0.173);
const SUAVE = rgb(0.353, 0.392, 0.455);
const LINHA = rgb(0.886, 0.898, 0.918);
const ACAO = rgb(1, 0.69, 0.125);

/** Euros com separadores portugueses (o "€" existe na codificação WinAnsi das fontes base). */
export function euros(v: number) {
  const [int, dec] = Math.abs(v).toFixed(2).split(".");
  const milhares = int!.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${v < 0 ? "-" : ""}${milhares},${dec} €`;
}

/** Remove caracteres que a fonte base não sabe desenhar (evita que o PDF falhe por um nome com emoji). */
function seguro(fonte: PDFFont, texto: string) {
  let out = "";
  for (const ch of texto.replace(/[\r\n\t]+/g, " ")) {
    try {
      fonte.encodeText(ch);
      out += ch;
    } catch {
      out += "?";
    }
  }
  return out;
}

function cortar(fonte: PDFFont, texto: string, tamanho: number, largura: number) {
  const t = seguro(fonte, texto);
  if (fonte.widthOfTextAtSize(t, tamanho) <= largura) return t;
  let s = t;
  while (s.length > 1 && fonte.widthOfTextAtSize(`${s}…`, tamanho) > largura) s = s.slice(0, -1);
  return `${s}…`;
}

export async function gerarReciboPdf(d: DadosRecibo, logo: { bytes: Buffer; mime: string } | null): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Recibo ${d.numero}`);
  pdf.setAuthor(d.entidade.nome);
  pdf.setSubject("Recibo de pagamento (documento interno)");
  pdf.setProducer("GesForma");
  const page: PDFPage = pdf.addPage([595.28, 841.89]);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const M = 56;
  const W = page.getWidth() - M * 2;
  let y = page.getHeight() - M;

  const texto = (t: string, x: number, yy: number, o: { tam?: number; fonte?: PDFFont; cor?: ReturnType<typeof rgb>; larg?: number } = {}) => {
    const fonte = o.fonte ?? normal;
    const tam = o.tam ?? 10;
    page.drawText(cortar(fonte, t, tam, o.larg ?? W), { x, y: yy, size: tam, font: fonte, color: o.cor ?? TINTA });
  };

  // Cabeçalho: logótipo à esquerda, número à direita.
  let alturaLogo = 0;
  if (logo) {
    try {
      const img = logo.mime === "image/png" ? await pdf.embedPng(logo.bytes) : await pdf.embedJpg(logo.bytes);
      const escala = Math.min(150 / img.width, 48 / img.height, 1);
      alturaLogo = img.height * escala;
      page.drawImage(img, { x: M, y: y - alturaLogo, width: img.width * escala, height: alturaLogo });
    } catch {
      alturaLogo = 0;
    }
  }
  if (!alturaLogo) {
    texto(d.entidade.nome, M, y - 16, { tam: 14, fonte: negrito, larg: W - 200 });
    alturaLogo = 20;
  }
  texto("RECIBO DE PAGAMENTO", M + W - 200, y - 12, { tam: 12, fonte: negrito, larg: 200 });
  texto(`N.º ${d.numero}`, M + W - 200, y - 28, { tam: 11, larg: 200 });
  texto(`Emitido em ${d.emitidoEm}`, M + W - 200, y - 42, { tam: 9, cor: SUAVE, larg: 200 });
  y -= Math.max(alturaLogo, 48) + 18;
  page.drawRectangle({ x: M, y, width: W, height: 3, color: ACAO });
  y -= 22;

  // Entidade e pagador, lado a lado.
  const col = W / 2 - 10;
  const bloco = (titulo: string, linhas: string[], x: number, topo: number) => {
    texto(titulo.toUpperCase(), x, topo, { tam: 8, fonte: negrito, cor: SUAVE, larg: col });
    let yy = topo - 15;
    for (const l of linhas.filter(Boolean)) {
      texto(l, x, yy, { larg: col });
      yy -= 13;
    }
    return yy;
  };
  const e = d.entidade;
  const local = [e.codigoPostal, e.localidade].filter(Boolean).join(" ");
  const fimE = bloco("Entidade", [e.nome, e.nif ? `NIF ${e.nif}` : "", e.morada, local, [e.telefone, e.email].filter(Boolean).join(" · ")], M, y);
  const fimP = bloco("Recebido de", [d.pagador.nome, d.pagador.nif ? `NIF ${d.pagador.nif}` : "", d.pagador.morada, d.pagador.email], M + col + 20, y);
  y = Math.min(fimE, fimP) - 16;

  // Tabela do pagamento.
  page.drawRectangle({ x: M, y: y - 4, width: W, height: 20, color: rgb(0.961, 0.965, 0.973) });
  texto("Descrição", M + 8, y + 2, { tam: 9, fonte: negrito, cor: SUAVE });
  texto("Valor", M + W - 90, y + 2, { tam: 9, fonte: negrito, cor: SUAVE, larg: 82 });
  y -= 22;
  texto(d.curso || "Inscrição", M + 8, y, { larg: W - 120 });
  const valorTxt = euros(d.valor);
  page.drawText(seguro(negrito, valorTxt), { x: M + W - 8 - negrito.widthOfTextAtSize(valorTxt, 11), y, size: 11, font: negrito, color: TINTA });
  if (d.turma) { y -= 13; texto(`Turma: ${d.turma}`, M + 8, y, { tam: 9, cor: SUAVE, larg: W - 120 }); }
  if (d.formando) { y -= 13; texto(`Formando: ${d.formando}`, M + 8, y, { tam: 9, cor: SUAVE, larg: W - 120 }); }
  y -= 12;
  page.drawLine({ start: { x: M, y }, end: { x: M + W, y }, thickness: 0.8, color: LINHA });
  y -= 18;
  texto("Total recebido", M + 8, y, { fonte: negrito });
  page.drawText(valorTxt, { x: M + W - 8 - negrito.widthOfTextAtSize(valorTxt, 12), y, size: 12, font: negrito, color: TINTA });
  y -= 30;

  const detalhe: [string, string][] = [
    ["Data do pagamento", d.data],
    ["Método", d.metodo],
    ["Referência interna", d.referencia],
    ["Confirmado por", d.confirmadoPor],
  ];
  for (const [k, v] of detalhe) {
    if (!v) continue;
    texto(k, M, y, { tam: 9, cor: SUAVE, larg: 140 });
    texto(v, M + 150, y, { larg: W - 150 });
    y -= 15;
  }
  if (e.iban) {
    y -= 6;
    texto("Conta para transferências", M, y, { tam: 9, cor: SUAVE, larg: 140 });
    texto(`${e.iban}${e.titularConta ? ` · ${e.titularConta}` : ""}`, M + 150, y, { larg: W - 150 });
    y -= 15;
  }

  // Rodapé com o aviso legal.
  const fundo = M + 30;
  page.drawLine({ start: { x: M, y: fundo + 26 }, end: { x: M + W, y: fundo + 26 }, thickness: 0.8, color: LINHA });
  texto("Documento interno de quitação. Não substitui a fatura nem a fatura-recibo emitidas por programa certificado.", M, fundo + 12, { tam: 8, cor: SUAVE });
  texto(`Recibo ${d.numero} · gerado pelo GesForma`, M, fundo, { tam: 8, cor: SUAVE });

  return Buffer.from(await pdf.save());
}
