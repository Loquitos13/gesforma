/**
 * Preencher um modelo Excel oficial sem o reconstruir: lê-se o .xlsx (um zip), escrevem-se valores
 * nas linhas de uma folha e volta-se a fechar o zip com as restantes partes byte a byte iguais.
 * Assim ficam os estilos, as folhas escondidas, os nomes definidos e as validações (incluindo as
 * x14 do extLst), que o SheetJS comunitário perde ao escrever.
 */
import * as zlib from "node:zlib";

type EntradaZip = { nome: string; metodo: number; crc: number; tamanho: number; dados: Buffer };

/** Lê as entradas de um zip pelo directório central (sem zip64: os modelos são pequenos). */
export function lerZip(zip: Buffer): EntradaZip[] {
  let fim = -1;
  for (let i = zip.length - 22; i >= Math.max(0, zip.length - 65_557); i--) {
    if (zip.readUInt32LE(i) === 0x06054b50) { fim = i; break; }
  }
  if (fim < 0) throw new Error("O modelo Excel não é um ficheiro zip válido.");
  const total = zip.readUInt16LE(fim + 10);
  let p = zip.readUInt32LE(fim + 16);
  const out: EntradaZip[] = [];
  for (let n = 0; n < total; n++) {
    if (zip.readUInt32LE(p) !== 0x02014b50) throw new Error("Directório do zip inválido.");
    const metodo = zip.readUInt16LE(p + 10);
    const crc = zip.readUInt32LE(p + 16);
    const comprimido = zip.readUInt32LE(p + 20);
    const tamanho = zip.readUInt32LE(p + 24);
    const lNome = zip.readUInt16LE(p + 28);
    const lExtra = zip.readUInt16LE(p + 30);
    const lComentario = zip.readUInt16LE(p + 32);
    const local = zip.readUInt32LE(p + 42);
    const nome = zip.toString("utf8", p + 46, p + 46 + lNome);
    const inicio = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    out.push({ nome, metodo, crc, tamanho, dados: zip.subarray(inicio, inicio + comprimido) });
    p += 46 + lNome + lExtra + lComentario;
  }
  return out;
}

export function conteudoZip(e: EntradaZip): Buffer {
  if (e.metodo === 0) return e.dados;
  if (e.metodo === 8) return zlib.inflateRawSync(e.dados);
  throw new Error(`Compressão ${e.metodo} não suportada no modelo.`);
}

function crc32(buf: Buffer) {
  return zlib.crc32(buf) >>> 0;
}

/** Fecha o zip: as entradas sem `novo` vão tal como estavam (mesmos bytes comprimidos). */
export function escreverZip(entradas: (EntradaZip & { novo?: Buffer })[]) {
  const locais: Buffer[] = [];
  const centrais: Buffer[] = [];
  let offset = 0;
  for (const e of entradas) {
    const nome = Buffer.from(e.nome, "utf8");
    let { metodo, crc, tamanho, dados } = e;
    if (e.novo) {
      dados = zlib.deflateRawSync(e.novo);
      metodo = 8;
      crc = crc32(e.novo);
      tamanho = e.novo.length;
    }
    const cab = Buffer.alloc(30);
    cab.writeUInt32LE(0x04034b50, 0);
    cab.writeUInt16LE(20, 4);
    cab.writeUInt16LE(0x0800, 6);
    cab.writeUInt16LE(metodo, 8);
    cab.writeUInt16LE(0, 10);
    cab.writeUInt16LE(0x21, 12);
    cab.writeUInt32LE(crc, 14);
    cab.writeUInt32LE(dados.length, 18);
    cab.writeUInt32LE(tamanho, 22);
    cab.writeUInt16LE(nome.length, 26);
    cab.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dados.length, 20);
    central.writeUInt32LE(tamanho, 24);
    central.writeUInt16LE(nome.length, 28);
    central.writeUInt32LE(offset, 42);
    locais.push(cab, nome, dados);
    centrais.push(central, nome);
    offset += 30 + nome.length + dados.length;
  }
  const dir = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(entradas.length, 8);
  fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(dir.length, 12);
  fim.writeUInt32LE(offset, 16);
  return Buffer.concat([...locais, dir, fim]);
}

// ─── Células ────────────────────────────────────────────────────────────────

/** Valor de uma célula: texto, número, ou data ISO (aaaa-mm-dd) gravada como data do Excel. */
export type ValorCelula = string | number | { data: string } | null | undefined;

export function letraColuna(n: number) {
  let s = "";
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

export function numeroColuna(letras: string) {
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function xmlTexto(s: string) {
  return s
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Dias desde 30/12/1899 (o número de série das datas do Excel). */
export function serieExcel(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isFinite(t) ? Math.round((t - Date.UTC(1899, 11, 30)) / 86_400_000) : null;
}

function celula(ref: string, estilo: string, v: ValorCelula) {
  const s = estilo ? ` s="${estilo}"` : "";
  if (v == null || v === "") return `<c r="${ref}"${s}/>`;
  if (typeof v === "number") return Number.isFinite(v) ? `<c r="${ref}"${s}><v>${v}</v></c>` : `<c r="${ref}"${s}/>`;
  if (typeof v === "object") {
    const n = serieExcel(v.data);
    return n == null ? `<c r="${ref}"${s}/>` : `<c r="${ref}"${s}><v>${n}</v></c>`;
  }
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${xmlTexto(v)}</t></is></c>`;
}

const RE_CELULA = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g;

/** Reescreve as células de uma linha (`<row …>…</row>`), mantendo o estilo de cada célula e as que não mudam. */
function reescreverLinha(xml: string, linha: number, valores: Map<number, ValorCelula>, limparColunas: Set<number>) {
  const abre = /^<row\b[^>]*?(\/?)>/.exec(xml);
  if (!abre) return xml;
  const cabecalho = abre[1] ? abre[0].slice(0, -2) + ">" : abre[0];
  const corpo = abre[1] ? "" : xml.slice(abre[0].length, xml.lastIndexOf("</row>"));
  const cel = new Map<number, string>();
  const estilos = new Map<number, string>();
  for (const m of corpo.matchAll(RE_CELULA)) {
    const col = numeroColuna(m[1]!);
    cel.set(col, m[0]);
    estilos.set(col, /\bs="(\d+)"/.exec(m[3]!)?.[1] ?? "");
  }
  for (const col of limparColunas) {
    if (cel.has(col) && !valores.has(col)) cel.set(col, celula(`${letraColuna(col)}${linha}`, estilos.get(col) ?? "", null));
  }
  for (const [col, v] of valores) {
    cel.set(col, celula(`${letraColuna(col)}${linha}`, estilos.get(col) ?? "", v));
  }
  const ordenadas = [...cel.entries()].sort((a, b) => a[0] - b[0]).map(([, x]) => x).join("");
  return `${cabecalho}${ordenadas}</row>`;
}

/**
 * Escreve `linhas` a partir da linha `primeira` da folha (XML de `xl/worksheets/sheetN.xml`).
 * Cada linha é um mapa coluna (letra) → valor. Nas linhas seguintes, até `limparAte`, as colunas
 * de `limpar` ficam sem valor (por exemplo um «Inserir» pré-preenchido no modelo).
 */
export function preencherFolha(
  folha: string,
  linhas: Record<string, ValorCelula>[],
  opts: { primeira: number; limparAte?: number; limpar?: string[] },
) {
  const ultima = Math.max(opts.primeira + linhas.length - 1, opts.limparAte ?? 0);
  const ini = folha.indexOf(`<row r="${opts.primeira}"`);
  const fimDados = folha.indexOf("</sheetData>");
  if (ini < 0 || fimDados < 0) throw new Error("O modelo não tem as linhas esperadas.");
  let fim = folha.indexOf(`<row r="${ultima + 1}"`, ini);
  if (fim < 0 || fim > fimDados) fim = fimDados;
  const limpar = new Set((opts.limpar ?? []).map(numeroColuna));
  const regiao = folha.slice(ini, fim).replace(/<row r="(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g, (xml, n: string) => {
    const linha = Number(n);
    const dados = linhas[linha - opts.primeira];
    const valores = new Map<number, ValorCelula>();
    if (dados) for (const [col, v] of Object.entries(dados)) if (v != null && v !== "") valores.set(numeroColuna(col), v);
    return reescreverLinha(xml, linha, valores, dados ? new Set() : limpar);
  });
  return folha.slice(0, ini) + regiao + folha.slice(fim);
}
