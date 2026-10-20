/**
 * O que a assinatura CC/CMD pode acrescentar ao PDF enviado. A app Autenticação.gov assina com uma actualização
 * incremental: o original fica intacto e acrescenta-se uma revisão com o campo de assinatura (widget e /Sig), o
 * /AcroForm, o /Annots da página, a aparência da assinatura e, às vezes, o /DSS. Mas uma actualização incremental
 * também pode trocar o texto de uma página antes de assinar, e a assinatura cobre essa troca. Aqui lê-se a revisão
 * acrescentada como um leitor de PDF a lê (pela tabela de referências, não pela ordem no ficheiro) e só se aceita:
 *  - uma única revisão, encadeada no original (/Prev) e com o mesmo catálogo (/Root), sem cifra;
 *  - objectos novos à vontade (só contam se forem alcançáveis a partir do que mudou, e isso está limitado abaixo);
 *  - objectos do original substituídos só se forem: o catálogo (só mudam /AcroForm, /DSS, /Perms, /Extensions,
 *    /Metadata), uma página (só muda /Annots), o /Info, o /Metadata, o /AcroForm ou o /Annots que já existissem;
 *  - nenhuma remoção (entrada livre) nem nova geração de um objecto do original;
 *  - nas páginas, as anotações do original mantêm-se e as novas são widgets de campos de assinatura (/FT /Sig),
 *    sem acções; no /AcroForm, só campos novos de assinatura e sem /XFA.
 * Assim o conteúdo das páginas (streams, recursos, fontes, árvore de páginas) é byte a byte o do original.
 * Limite: a aparência de um widget de assinatura é um desenho livre de quem assina; uma aparência desenhada por
 * cima do texto pode tapá-lo visualmente (é o mesmo limite dos leitores de PDF, que tratam a assinatura como
 * alteração permitida). O texto do documento, esse, continua o do original.
 */
import {
  PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFObjectParser, PDFRawStream, PDFRef, decodePDFRawStream,
  type PDFContext, type PDFObject,
} from "pdf-lib";

export class RevisaoInvalida extends Error {}

const N = (s: string) => PDFName.of(s);
const PERMITIDAS_CATALOGO = new Set(["/AcroForm", "/DSS", "/Perms", "/Extensions", "/Metadata"]);
const PERMITIDAS_PAGINA = new Set(["/Annots"]);

type Entrada = { num: number; gen: number; tipo: 0 | 1 | 2; pos: number; idx: number };

const falha = (porque: string): never => {
  throw new RevisaoInvalida(porque);
};

/** Bytes de um objecto, para comparar: dicionário/array serializado, e o conteúdo tal e qual nos streams. */
function serial(o: PDFObject | undefined): string {
  if (!o) return "";
  if (o instanceof PDFRawStream) return `${o.dict.toString()}\nstream\n${Buffer.from(o.contents).toString("latin1")}`;
  return o.toString();
}

/** As chaves que mudaram entre dois dicionários. */
function chavesMudadas(a: PDFDict, b: PDFDict) {
  const ma = new Map(a.entries().map(([k, v]) => [k.toString(), serial(v)]));
  const mb = new Map(b.entries().map(([k, v]) => [k.toString(), serial(v)]));
  return [...new Set([...ma.keys(), ...mb.keys()])].filter(k => ma.get(k) !== mb.get(k));
}

function numero(d: PDFDict | undefined, chave: string, omissao: number) {
  const v = d?.lookup(N(chave));
  return v instanceof PDFNumber ? v.asNumber() : omissao;
}

/** Desfaz os preditores PNG (os habituais nos streams de referências). */
function semPreditor(dados: Uint8Array, parms: PDFObject | undefined) {
  const p = parms instanceof PDFDict ? parms : undefined;
  const preditor = numero(p, "Predictor", 1);
  if (preditor === 1) return dados;
  if (preditor < 10 || numero(p, "Colors", 1) !== 1 || numero(p, "BitsPerComponent", 8) !== 8) falha("preditor não suportado");
  const col = numero(p, "Columns", 1);
  const linhas = Math.floor(dados.length / (col + 1));
  const out = new Uint8Array(linhas * col);
  let cima = new Uint8Array(col);
  for (let r = 0; r < linhas; r++) {
    const filtro = dados[r * (col + 1)]!;
    const linha = out.subarray(r * col, (r + 1) * col);
    for (let i = 0; i < col; i++) {
      const x = dados[r * (col + 1) + 1 + i]!;
      const a = i ? linha[i - 1]! : 0;
      const b = cima[i]!;
      const c = i ? cima[i - 1]! : 0;
      let base: number;
      if (filtro === 0) base = 0;
      else if (filtro === 1) base = a;
      else if (filtro === 2) base = b;
      else if (filtro === 3) base = (a + b) >> 1;
      else if (filtro === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        base = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else return falha("preditor inválido");
      linha[i] = (x + base) & 0xff;
    }
    cima = linha;
  }
  return out;
}

const descodificar = (s: PDFRawStream) => semPreditor(decodePDFRawStream(s).decode(), s.dict.lookup(N("DecodeParms")));

/** O objecto indirecto que começa em `pos` ("n g obj ..."). */
function objectoEm(pdf: Buffer, pos: number, ctx: PDFContext) {
  const m = /^(\d+)\s+(\d+)\s+obj\b/.exec(pdf.subarray(pos, pos + 40).toString("latin1"));
  if (!m) return falha("referência para fora de um objecto");
  const obj = PDFObjectParser.forBytes(pdf.subarray(pos + m[0].length), ctx).parseObject();
  return { num: Number(m[1]), gen: Number(m[2]), obj };
}

/** Tabela de referências clássica ("xref ... trailer << >>") que começa em `pos`. */
function tabelaClassica(pdf: Buffer, s: string, pos: number, ctx: PDFContext) {
  const entradas: Entrada[] = [];
  const re = /\s*(\d+)\s+(\d+)[ \t]*\r?\n/y;
  const linha = /(\d{10})\s(\d{5})\s([nf])\s{0,2}/y;
  let i = pos + 4;
  for (;;) {
    re.lastIndex = i;
    const sub = re.exec(s);
    if (!sub) break;
    i = re.lastIndex;
    const [primeiro, total] = [Number(sub[1]), Number(sub[2])];
    for (let k = 0; k < total; k++) {
      linha.lastIndex = i;
      const e = linha.exec(s) ?? falha("tabela de referências inválida");
      i = linha.lastIndex;
      entradas.push({ num: primeiro + k, gen: Number(e[2]), tipo: e[3] === "n" ? 1 : 0, pos: Number(e[1]), idx: 0 });
    }
  }
  const t = /\s*trailer\s*/y;
  t.lastIndex = i;
  if (!t.exec(s)) falha("sem trailer");
  const trailer = PDFObjectParser.forBytes(pdf.subarray(t.lastIndex), ctx).parseObject();
  if (!(trailer instanceof PDFDict)) return falha("trailer inválido");
  return { entradas, trailer };
}

/** Stream de referências (/Type /XRef) que começa em `pos`. */
function streamDeReferencias(pdf: Buffer, pos: number, ctx: PDFContext) {
  const { obj } = objectoEm(pdf, pos, ctx);
  if (!(obj instanceof PDFRawStream) || obj.dict.get(N("Type")) !== N("XRef")) return falha("sem tabela de referências");
  const dados = descodificar(obj);
  const w = obj.dict.lookup(N("W"));
  if (!(w instanceof PDFArray) || w.size() !== 3) return falha("/W inválido");
  const larguras = [0, 1, 2].map(k => (w.lookup(k) as PDFNumber).asNumber());
  const indice = obj.dict.lookup(N("Index"));
  const pares = indice instanceof PDFArray
    ? Array.from({ length: indice.size() / 2 }, (_, k) => [(indice.lookup(2 * k) as PDFNumber).asNumber(), (indice.lookup(2 * k + 1) as PDFNumber).asNumber()])
    : [[0, numero(obj.dict, "Size", 0)]];
  const entradas: Entrada[] = [];
  let p = 0;
  const ler = (largura: number, omissao: number) => {
    if (!largura) return omissao;
    let v = 0;
    for (let k = 0; k < largura; k++) v = v * 256 + (dados[p++] ?? falha("stream de referências curto"));
    return v;
  };
  for (const [primeiro, total] of pares) {
    for (let k = 0; k < total!; k++) {
      const tipo = ler(larguras[0]!, 1);
      const campo2 = ler(larguras[1]!, 0);
      const campo3 = ler(larguras[2]!, 0);
      if (tipo > 2) continue;
      entradas.push({ num: primeiro! + k, tipo: tipo as 0 | 1 | 2, pos: campo2, gen: tipo === 2 ? 0 : campo3, idx: campo3 });
    }
  }
  return { entradas, trailer: obj.dict };
}

/** Objecto `idx` de um stream de objectos (/Type /ObjStm). */
function objectoDeStream(stm: PDFObject, idx: number, ctx: PDFContext) {
  if (!(stm instanceof PDFRawStream) || stm.dict.get(N("Type")) !== N("ObjStm")) return falha("stream de objectos inválido");
  const dados = descodificar(stm);
  const primeiro = numero(stm.dict, "First", 0);
  const cabeca = Buffer.from(dados.subarray(0, primeiro)).toString("latin1").trim().split(/\s+/).map(Number);
  const desvio = cabeca[2 * idx + 1];
  if (desvio === undefined) return falha("objecto em falta no stream de objectos");
  return PDFObjectParser.forBytes(dados.subarray(primeiro + desvio), ctx).parseObject();
}

/** O campo (widget ou um dos pais) é de assinatura e o widget não tem acções. */
function widgetDeAssinatura(o: PDFObject | undefined, ctx: PDFContext) {
  if (!(o instanceof PDFDict)) return false;
  if (o.has(N("A")) || o.has(N("AA"))) return false;
  let atual: PDFDict | undefined = o;
  for (let nivel = 0; atual && nivel < 10; nivel++) {
    const ft = atual.get(N("FT"));
    if (ft) return ft === N("Sig");
    const pai = atual.get(N("Parent"));
    atual = pai ? ctx.lookupMaybe(pai, PDFDict) : undefined;
  }
  return false;
}

const etiqueta = (o: PDFObject | undefined) => (o instanceof PDFRef ? o.tag : "");
const itens = (a: PDFArray | undefined) => (a ? a.asArray() : []);

/**
 * Confirma que `pdf` é `original` mais uma única revisão que só acrescenta assinatura (ver o topo do ficheiro).
 * Lança RevisaoInvalida com o motivo (para o registo); o signatário vê uma mensagem genérica.
 */
export async function verificarRevisaoAssinatura(original: Buffer, pdf: Buffer) {
  const s = pdf.toString("latin1");
  const acrescento = s.slice(original.length);
  const fins = [...acrescento.matchAll(/startxref\s+(\d+)\s+%%EOF/g)];
  if (fins.length !== 1 || (acrescento.match(/startxref/g) ?? []).length !== 1) falha("mais do que uma revisão");
  const posXref = Number(fins[0]![1]);
  if (posXref < original.length || posXref >= pdf.length) falha("tabela de referências fora da revisão");
  const origStart = [...original.toString("latin1").matchAll(/startxref\s+(\d+)/g)].at(-1);
  if (!origStart) falha("original sem startxref");

  const doc = await PDFDocument.load(original, { updateMetadata: false });
  const ctx = doc.context;
  const antes = new Map(ctx.enumerateIndirectObjects().map(([r, o]) => [r.objectNumber, { ref: r, obj: o }]));
  const raiz = ctx.trailerInfo.Root as PDFRef;
  const catalogoAntes = ctx.lookup(raiz, PDFDict);
  const paginas = doc.getPages().map(p => ({ ref: p.ref, annots: itens(p.node.lookupMaybe(N("Annots"), PDFArray)).map(serial) }));
  const acroAntes = catalogoAntes.lookupMaybe(N("AcroForm"), PDFDict);
  const camposAntes = new Set(itens(acroAntes?.lookupMaybe(N("Fields"), PDFArray)).map(serial));
  const substituiveis = new Set([
    etiqueta(ctx.trailerInfo.Info), etiqueta(catalogoAntes.get(N("Metadata"))), etiqueta(catalogoAntes.get(N("AcroForm"))),
    etiqueta(acroAntes?.get(N("Fields"))), ...doc.getPages().map(p => etiqueta(p.node.get(N("Annots")))),
  ].filter(Boolean));

  // A revisão como um leitor a vê: as entradas da tabela de referências.
  const { entradas, trailer } = s.startsWith("xref", posXref) ? tabelaClassica(pdf, s, posXref, ctx) : streamDeReferencias(pdf, posXref, ctx);
  if (trailer.has(N("Encrypt")) || trailer.has(N("XRefStm"))) falha("trailer com /Encrypt ou /XRefStm");
  if (etiqueta(trailer.get(N("Root"))) !== raiz.tag) falha("catálogo trocado");
  if (numero(trailer, "Prev", -1) !== Number(origStart![1])) falha("/Prev não aponta para o original");

  const novos = new Map<number, { ref: PDFRef; obj: PDFObject }>();
  const lidosDeStream = new Map<number, PDFObject>();
  for (const e of entradas) {
    if (e.num === 0) continue;
    const velho = antes.get(e.num);
    if (e.tipo === 0) {
      if (velho) falha(`objecto ${e.num} do original removido`);
      continue;
    }
    if (velho && velho.ref.generationNumber !== e.gen) falha(`objecto ${e.num} do original com outra geração`);
    if (novos.has(e.num)) falha(`objecto ${e.num} repetido`);
    // O próprio stream de referências (só conta como objecto novo, não como do documento).
    if (e.tipo === 1 && e.pos === posXref && !velho) continue;
    let obj: PDFObject;
    if (e.tipo === 1) {
      if (e.pos < original.length || e.pos >= posXref) falha(`objecto ${e.num} fora da revisão`);
      const lido = objectoEm(pdf, e.pos, ctx);
      if (lido.num !== e.num || lido.gen !== e.gen) falha(`objecto ${e.num} não está onde a tabela diz`);
      obj = lido.obj;
    } else {
      const contentor = entradas.find(x => x.num === e.pos && x.tipo === 1) ?? falha(`stream de objectos ${e.pos} fora da revisão`);
      let stm = lidosDeStream.get(contentor.num);
      if (!stm) {
        if (contentor.pos < original.length || contentor.pos >= posXref) falha("stream de objectos fora da revisão");
        stm = objectoEm(pdf, contentor.pos, ctx).obj;
        lidosDeStream.set(contentor.num, stm);
      }
      obj = objectoDeStream(stm, e.idx, ctx);
    }
    novos.set(e.num, { ref: PDFRef.of(e.num, e.gen), obj });
  }

  // Objectos do original substituídos: só os que a assinatura precisa de tocar, e só no que precisa.
  for (const [num, { ref, obj }] of novos) {
    const velho = antes.get(num);
    if (!velho || serial(velho.obj) === serial(obj)) continue;
    if (ref.tag === raiz.tag) {
      if (!(obj instanceof PDFDict)) falha("catálogo inválido");
      const mudadas = chavesMudadas(catalogoAntes, obj as PDFDict).filter(k => !PERMITIDAS_CATALOGO.has(k));
      if (mudadas.length) falha(`catálogo alterado (${mudadas.join(", ")})`);
    } else if (paginas.some(p => p.ref.tag === ref.tag)) {
      if (!(obj instanceof PDFDict) || !(velho.obj instanceof PDFDict)) return falha("página inválida");
      const mudadas = chavesMudadas(velho.obj, obj).filter(k => !PERMITIDAS_PAGINA.has(k));
      if (mudadas.length) falha(`página alterada (${mudadas.join(", ")})`);
    } else if (!substituiveis.has(ref.tag)) {
      falha(`objecto ${num} do original alterado`);
    }
  }

  // A partir daqui, o documento final (original + revisão).
  for (const { ref, obj } of novos.values()) ctx.assign(ref, obj);

  for (const p of paginas) {
    const annots = itens(ctx.lookup(p.ref, PDFDict).lookupMaybe(N("Annots"), PDFArray));
    const agora = annots.map(serial);
    if (p.annots.some(a => !agora.includes(a))) falha("anotação do original removida");
    for (const a of annots) {
      if (p.annots.includes(serial(a))) continue;
      if (!widgetDeAssinatura(a instanceof PDFRef ? ctx.lookup(a) : a, ctx)) falha("anotação nova que não é uma assinatura");
    }
  }
  const acro = ctx.lookup(raiz, PDFDict).lookupMaybe(N("AcroForm"), PDFDict);
  if (acro) {
    if (acro.has(N("XFA"))) falha("formulário XFA");
    for (const f of itens(acro.lookupMaybe(N("Fields"), PDFArray))) {
      if (camposAntes.has(serial(f))) continue;
      if (!widgetDeAssinatura(f instanceof PDFRef ? ctx.lookup(f) : f, ctx)) falha("campo novo que não é de assinatura");
    }
    for (const f of camposAntes) if (!itens(acro.lookupMaybe(N("Fields"), PDFArray)).some(x => serial(x) === f)) falha("campo do original removido");
  }
}
