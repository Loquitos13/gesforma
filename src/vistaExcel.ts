import { limparGrelha } from "./csvAvaliacao";

export type EstiloCelula = {
  bg?: string;
  cor?: string;
  negrito?: boolean;
  tamanho?: number;
  alinhamento?: "left" | "center" | "right";
  vertical?: "top" | "middle" | "bottom";
  quebra?: boolean;
  rotacao?: number;
  fonte?: string;
};

export type UniaoCelula = { r: number; c: number; linhas: number; colunas: number };

export type VistaFolha = {
  larguras: number[];
  alturas: number[];
  estilos: (EstiloCelula | null)[][];
  unioes: UniaoCelula[];
};

export type FolhaImportada = {
  nome: string;
  grid: string[][];
  vista: VistaFolha | null;
};

type Livro = {
  SheetNames: string[];
  Sheets: Record<string, Record<string, unknown>>;
  Styles?: {
    Fonts?: Fonte[];
    Fills?: Preenchimento[];
    CellXf?: Xf[];
  };
  files?: Record<string, { content?: unknown }>;
};

type Fonte = { bold?: number | boolean; sz?: number; color?: { rgb?: string }; name?: string };
type Preenchimento = { patternType?: string; fgColor?: { rgb?: string } };
type Xf = {
  fontId?: number | string;
  fillId?: number | string;
  alignment?: { horizontal?: string; vertical?: string; wrapText?: boolean | number | string; textRotation?: number | string };
};

type Xlsx = {
  read: (data: ArrayBuffer, opts: Record<string, unknown>) => Livro;
  utils: {
    decode_range: (ref: string) => { s: { r: number; c: number }; e: { r: number; c: number } };
    sheet_to_json: (sheet: unknown, opts: Record<string, unknown>) => unknown[][];
  };
};

function corCss(rgb?: string) {
  if (!rgb) return undefined;
  const h = rgb.replace("#", "");
  const hex = h.length === 8 ? h.slice(2) : h;
  return /^[0-9A-Fa-f]{6}$/.test(hex) ? `#${hex}` : undefined;
}

function indiceColuna(letras: string) {
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function textoFicheiro(content: unknown) {
  if (typeof content === "string") return content;
  if (content instanceof Uint8Array) return new TextDecoder().decode(content);
  if (content && typeof content === "object" && "length" in content) {
    return new TextDecoder().decode(Uint8Array.from(content as ArrayLike<number>));
  }
  return "";
}

function caminhoFolha(livro: Livro, indice: number) {
  const rels = textoFicheiro(livro.files?.["xl/_rels/workbook.xml.rels"]?.content);
  const livroXml = textoFicheiro(livro.files?.["xl/workbook.xml"]?.content);
  const folhas = [...livroXml.matchAll(/<sheet\b[^>]*r:id="([^"]+)"/g)].map(m => m[1]);
  const id = folhas[indice];
  if (!id || !rels) return `xl/worksheets/sheet${indice + 1}.xml`;
  const rel = rels.match(new RegExp(`Id="${id}"[^>]*Target="([^"]+)"`)) || rels.match(new RegExp(`Target="([^"]+)"[^>]*Id="${id}"`));
  const alvo = rel?.[1] ?? `worksheets/sheet${indice + 1}.xml`;
  return alvo.startsWith("xl/") ? alvo : `xl/${alvo.replace(/^\//, "")}`;
}

function grelhaAlinhada(XLSX: Xlsx, sheet: Record<string, unknown>) {
  const ref = String(sheet["!ref"] ?? "");
  if (!ref) return [] as string[][];
  const range = XLSX.utils.decode_range(ref);
  const bruto = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
  const linhas: string[][] = [];
  for (let r = 0; r <= range.e.r; r++) {
    const linha = Array.from({ length: range.e.c + 1 }, () => "");
    if (r >= range.s.r) {
      const src = bruto[r - range.s.r] ?? [];
      for (let c = 0; c < src.length; c++) {
        const dest = c + range.s.c;
        if (dest < linha.length) linha[dest] = String(src[c] ?? "").replace(/\s+/g, " ").trim();
      }
    }
    linhas.push(linha);
  }
  return limparGrelha(linhas);
}

function estiloDe(xf: Xf | undefined, livro: Livro): EstiloCelula | null {
  if (!xf) return null;
  const fonte = livro.Styles?.Fonts?.[Number(xf.fontId)] ;
  const fill = livro.Styles?.Fills?.[Number(xf.fillId)];
  const alinhamento = xf.alignment;
  const estilo: EstiloCelula = {};
  if (fill?.patternType === "solid") {
    const bg = corCss(fill.fgColor?.rgb);
    if (bg && bg.toLowerCase() !== "#ffffff") estilo.bg = bg;
  }
  const cor = corCss(fonte?.color?.rgb);
  if (cor && cor.toLowerCase() !== "#000000") estilo.cor = cor;
  if (fonte?.bold) estilo.negrito = true;
  if (fonte?.sz) estilo.tamanho = Math.round(Number(fonte.sz) * 4 / 3);
  if (fonte?.name) estilo.fonte = fonte.name;
  if (alinhamento?.horizontal === "center" || alinhamento?.horizontal === "right" || alinhamento?.horizontal === "left") {
    estilo.alinhamento = alinhamento.horizontal;
  }
  if (alinhamento?.vertical === "center") estilo.vertical = "middle";
  else if (alinhamento?.vertical === "top") estilo.vertical = "top";
  else if (alinhamento?.vertical === "bottom") estilo.vertical = "bottom";
  if (alinhamento?.wrapText === true || alinhamento?.wrapText === 1 || alinhamento?.wrapText === "1") estilo.quebra = true;
  const rotacao = Number(alinhamento?.textRotation);
  if (rotacao === 90 || rotacao === 255) estilo.rotacao = rotacao;
  return Object.keys(estilo).length ? estilo : null;
}

export function vistaDaFolha(livro: Livro, indice: number, grid: string[][]): VistaFolha {
  const sheet = livro.Sheets[livro.SheetNames[indice] ?? ""] ?? {};
  const largura = grid.reduce((m, linha) => Math.max(m, linha.length), 0);
  const cols = (sheet["!cols"] as { wpx?: number; width?: number }[] | undefined) ?? [];
  const larguras = Array.from({ length: largura }, (_, c) => {
    const col = cols[c];
    const px = col?.wpx || (col?.width ? Math.round(col.width * 8) : 72);
    return Math.max(28, Math.min(px, 420));
  });
  const xml = textoFicheiro(livro.files?.[caminhoFolha(livro, indice)]?.content);
  const alturas = Array.from({ length: grid.length }, () => 22);
  for (const m of xml.matchAll(/<row\b[^>]*r="(\d+)"[^>]*>/g)) {
    const r = Number(m[1]) - 1;
    const ht = m[0].match(/\bht="([\d.]+)"/);
    if (r >= 0 && r < alturas.length && ht) alturas[r] = Math.max(18, Math.round(Number(ht[1]) * 4 / 3));
  }
  const porIndice = new Map<string, number>();
  for (const m of xml.matchAll(/<c\b[^>]*r="([A-Z]+)(\d+)"[^>]*>/g)) {
    const s = m[0].match(/\bs="(\d+)"/);
    if (!s) continue;
    const r = Number(m[2]) - 1;
    const c = indiceColuna(m[1]);
    if (r >= 0 && r < grid.length && c >= 0 && c < largura) porIndice.set(`${r}:${c}`, Number(s[1]));
  }
  const estilos = grid.map((linha, r) => linha.map((_, c) => {
    const id = porIndice.get(`${r}:${c}`);
    if (id == null) return null;
    return estiloDe(livro.Styles?.CellXf?.[id], livro);
  }));
  const merges = ((sheet["!merges"] as { s: { r: number; c: number }; e: { r: number; c: number } }[] | undefined) ?? []);
  const unioes: UniaoCelula[] = [];
  for (const merge of merges) {
    if (merge.s.r >= grid.length || merge.s.c >= largura) continue;
    unioes.push({
      r: merge.s.r,
      c: merge.s.c,
      linhas: Math.min(merge.e.r, grid.length - 1) - merge.s.r + 1,
      colunas: Math.min(merge.e.c, largura - 1) - merge.s.c + 1,
    });
  }
  return { larguras, alturas, estilos, unioes };
}

export async function lerLivroExcel(data: ArrayBuffer): Promise<FolhaImportada[]> {
  const XLSX = await import("xlsx") as unknown as Xlsx;
  const livro = XLSX.read(data, { type: "array", cellStyles: true, bookFiles: true });
  return livro.SheetNames.map((nome, indice) => {
    const grid = grelhaAlinhada(XLSX, livro.Sheets[nome] ?? {});
    return {
      nome,
      grid,
      vista: grid.length ? vistaDaFolha(livro, indice, grid) : null,
    };
  }).filter(folha => folha.grid.length);
}
