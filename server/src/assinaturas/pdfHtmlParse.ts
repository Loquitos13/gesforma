/**
 * Leitura do HTML das propostas e contratos (o subconjunto que o editor produz:
 * src/gesforma/vistas/crm/documento/modelo.ts). Tudo o que não se conhece é ignorado, mas o texto mantém-se.
 */

export type No = { tag: string; attrs: Record<string, string>; filhos: No[] } | { texto: string };

const VAZIAS = new Set(["br", "img", "hr", "meta", "input"]);
const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ordf: "ª", ordm: "º", euro: "€", ndash: "–", mdash: "—", hellip: "…", laquo: "«", raquo: "»" };

/** Escapa texto para entrar em HTML (o inverso de descodificar). */
export function escaparHtml(s: string) {
  return s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

export function descodificar(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

function lerAtributos(texto: string) {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) attrs[m[1]!.toLowerCase()] = descodificar(m[2] ?? m[3] ?? m[4] ?? "");
  return attrs;
}

/** Árvore simples do HTML (tolerante a etiquetas mal fechadas). */
export function analisar(html: string): No[] {
  const raiz = { tag: "#raiz", attrs: {}, filhos: [] as No[] };
  const pilha: { tag: string; attrs: Record<string, string>; filhos: No[] }[] = [raiz];
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)|</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const topo = pilha[pilha.length - 1]!;
    if (m[0].startsWith("<!--")) continue;
    if (m[3] !== undefined || m[0] === "<") {
      topo.filhos.push({ texto: descodificar(m[3] ?? "<") });
      continue;
    }
    const tag = m[1]!.toLowerCase();
    if (m[0][1] === "/") {
      const i = pilha.map(p => p.tag).lastIndexOf(tag);
      if (i > 0) pilha.length = i;
      continue;
    }
    const no = { tag, attrs: lerAtributos(m[2] ?? ""), filhos: [] as No[] };
    topo.filhos.push(no);
    if (!VAZIAS.has(tag) && !/\/\s*$/.test(m[2] ?? "")) pilha.push(no);
  }
  return raiz.filhos;
}

export type DefinicoesDoc = { logoPos: "esquerda" | "centro" | "direita"; logoAltura: number; mostrarNome: boolean; subtitulo: string };

/** Definições guardadas no elemento escondido `<div data-gf="doc">` (cabeçalho e logótipo). */
export function definicoesDe(nos: No[]): DefinicoesDoc {
  const def: DefinicoesDoc = { logoPos: "esquerda", logoAltura: 40, mostrarNome: true, subtitulo: "" };
  const meta = nos.find((n): n is Extract<No, { tag: string }> => "tag" in n && n.attrs["data-gf"] === "doc");
  if (!meta) return def;
  const pos = meta.attrs["data-logo-pos"];
  if (pos === "centro" || pos === "direita" || pos === "esquerda") def.logoPos = pos;
  const alt = Number(meta.attrs["data-logo-altura"]);
  if (alt >= 20 && alt <= 90) def.logoAltura = alt;
  def.mostrarNome = meta.attrs["data-nome"] !== "0";
  def.subtitulo = meta.attrs["data-subtitulo"] ?? "";
  return def;
}

export function alinhamento(attrs: Record<string, string>): "left" | "center" | "right" | "justify" {
  const m = /text-align\s*:\s*(left|center|right|justify)/i.exec(attrs.style ?? "");
  return (m?.[1]?.toLowerCase() as "left" | "center" | "right" | "justify") ?? "left";
}

/** O texto parece HTML do editor (e não o texto simples antigo). */
export function eHtml(texto: string) {
  return /^\s*</.test(texto);
}
