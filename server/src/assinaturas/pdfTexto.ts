/** Texto nos PDF de assinatura: página A4, quebra de linhas e caracteres que as fontes base conseguem desenhar. */
import { rgb, type PDFDocument, type PDFFont } from "pdf-lib";

export const A4: [number, number] = [595.28, 841.89];
export const MARGEM = 56;
/** Faixa do fundo da última página reservada à assinatura (de MARGEM+30 até `topo`). */
export const ZONA_ASSINATURA = { topo: 210 };

const TROCAS: Record<string, string> = {
  "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...",
  "•": "-", " ": " ", " ": " ", " ": " ", "\t": "    ",
};

/** Troca os caracteres que a fonte não desenha (WinAnsi) por equivalentes ou "?". */
export function larguraSegura(texto: string, fonte: PDFFont) {
  let out = "";
  for (const ch of texto.normalize("NFC")) {
    const c = TROCAS[ch] ?? ch;
    try {
      fonte.widthOfTextAtSize(c, 10);
      out += c;
    } catch {
      out += "?";
    }
  }
  return out;
}

/** Quebra uma linha de texto em linhas que cabem na largura dada. */
export function linhasDe(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  if (!texto.trim()) return [""];
  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) <= largura) {
      atual = tentativa;
      continue;
    }
    if (atual) linhas.push(atual);
    // Palavra maior que a linha (um hash, por exemplo): parte-se aos bocados.
    let resto = p;
    while (fonte.widthOfTextAtSize(resto, tamanho) > largura && resto.length > 1) {
      let n = resto.length;
      while (n > 1 && fonte.widthOfTextAtSize(resto.slice(0, n), tamanho) > largura) n -= 1;
      linhas.push(resto.slice(0, n));
      resto = resto.slice(n);
    }
    atual = resto;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Rodapé "Página x de y" em todas as páginas. */
export function rodapes(pdf: PDFDocument, fonte: PDFFont, texto: string) {
  const total = pdf.getPageCount();
  pdf.getPages().forEach((p, i) => {
    const t = larguraSegura(`${texto} · Página ${i + 1} de ${total}`, fonte);
    p.drawText(t, { x: MARGEM, y: 30, size: 7.5, font: fonte, color: rgb(0.55, 0.58, 0.63) });
  });
}
