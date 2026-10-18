export type DisposicaoHero = "texto-esquerda" | "texto-centro" | "texto-direita";
export type DisposicaoSeccao = "imagem-esquerda" | "imagem-direita";

export type BlocoBlog =
  | { id: string; tipo: "paragrafo"; texto: string }
  | { id: string; tipo: "titulo"; texto: string; nivel: "2" | "3" }
  | { id: string; tipo: "imagem"; url: string; alt: string; legenda: string }
  | { id: string; tipo: "hero"; titulo: string; texto: string; imagem: string; alt: string; botao: string; destino: string; disposicao: DisposicaoHero }
  | { id: string; tipo: "seccao"; titulo: string; texto: string; imagem: string; alt: string; disposicao: DisposicaoSeccao }
  | { id: string; tipo: "citacao"; texto: string; autor: string }
  | { id: string; tipo: "lista"; itens: string }
  | { id: string; tipo: "botao"; rotulo: string; destino: string }
  | { id: string; tipo: "separador" };

/** O que a página do artigo mostra à volta do texto: imagem de destaque, excerto e curso relacionado (id do curso no site). */
export type MetaArtigo = { capa: string; capaAlt: string; capaLegenda: string; excerto: string; curso: string };
export const metaVazia = (): MetaArtigo => ({ capa: "", capaAlt: "", capaLegenda: "", excerto: "", curso: "" });

export type DocumentoBlog = { v: 1; blocos: BlocoBlog[]; meta?: MetaArtigo };

// Imagens do próprio site ou https (nunca javascript: ou data:).
const imagemSegura = (v: unknown) => { const u = texto(v, 500).trim(); return /^(\/(?!\/)|https:\/\/)/i.test(u) ? u : ""; };

function metaDe(v: unknown): MetaArtigo | undefined {
  if (!v || typeof v !== "object") return undefined;
  const m = v as Record<string, unknown>;
  return {
    capa: imagemSegura(m.capa), capaAlt: texto(m.capaAlt, 200), capaLegenda: texto(m.capaLegenda, 300),
    excerto: texto(m.excerto, 600), curso: texto(m.curso, 200).replace(/[^a-z0-9-]/g, ""),
  };
}

export const LIMITE_CORPO_BLOG = 80_000;

export const TIPOS_BLOCO = [
  { tipo: "paragrafo", nome: "Parágrafo", nota: "Texto corrido" },
  { tipo: "titulo", nome: "Título", nota: "Abre uma secção" },
  { tipo: "imagem", nome: "Imagem", nota: "Fotografia com legenda" },
  { tipo: "hero", nome: "Hero", nota: "Destaque com imagem, texto e botão" },
  { tipo: "seccao", nome: "Secção", nota: "Texto ao lado de uma imagem" },
  { tipo: "citacao", nome: "Citação", nota: "Uma frase em destaque" },
  { tipo: "lista", nome: "Lista", nota: "Um item por linha" },
  { tipo: "botao", nome: "Botão", nota: "Ligação para uma página" },
  { tipo: "separador", nome: "Separador", nota: "Uma pausa entre blocos" },
] as const;

export type TipoBloco = (typeof TIPOS_BLOCO)[number]["tipo"];

export function idBloco() {
  return `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function texto(valor: unknown, max: number) {
  return typeof valor === "string" ? valor.slice(0, max) : "";
}

export function blocoNovo(tipo: TipoBloco): BlocoBlog {
  const id = idBloco();
  if (tipo === "titulo") return { id, tipo, texto: "", nivel: "2" };
  if (tipo === "imagem") return { id, tipo, url: "", alt: "", legenda: "" };
  if (tipo === "hero") return { id, tipo, titulo: "", texto: "", imagem: "", alt: "", botao: "", destino: "", disposicao: "texto-esquerda" };
  if (tipo === "seccao") return { id, tipo, titulo: "", texto: "", imagem: "", alt: "", disposicao: "imagem-esquerda" };
  if (tipo === "citacao") return { id, tipo, texto: "", autor: "" };
  if (tipo === "lista") return { id, tipo, itens: "" };
  if (tipo === "botao") return { id, tipo, rotulo: "", destino: "" };
  if (tipo === "separador") return { id, tipo };
  return { id, tipo: "paragrafo", texto: "" };
}

function blocoDe(bruto: unknown): BlocoBlog | null {
  if (!bruto || typeof bruto !== "object") return null;
  const b = bruto as Record<string, unknown>;
  const id = texto(b.id, 40) || idBloco();
  const tipo = String(b.tipo ?? "");
  if (tipo === "paragrafo") return { id, tipo, texto: texto(b.texto, 8000) };
  if (tipo === "titulo") return { id, tipo, texto: texto(b.texto, 300), nivel: b.nivel === "3" ? "3" : "2" };
  if (tipo === "imagem") return { id, tipo, url: texto(b.url, 2000), alt: texto(b.alt, 300), legenda: texto(b.legenda, 400) };
  if (tipo === "hero") {
    const disposicao: DisposicaoHero = b.disposicao === "texto-centro" || b.disposicao === "texto-direita" ? b.disposicao : "texto-esquerda";
    return { id, tipo, titulo: texto(b.titulo, 300), texto: texto(b.texto, 2000), imagem: texto(b.imagem, 2000), alt: texto(b.alt, 300), botao: texto(b.botao, 80), destino: texto(b.destino, 2000), disposicao };
  }
  if (tipo === "seccao") {
    const disposicao: DisposicaoSeccao = b.disposicao === "imagem-direita" ? "imagem-direita" : "imagem-esquerda";
    return { id, tipo, titulo: texto(b.titulo, 300), texto: texto(b.texto, 4000), imagem: texto(b.imagem, 2000), alt: texto(b.alt, 300), disposicao };
  }
  if (tipo === "citacao") return { id, tipo, texto: texto(b.texto, 2000), autor: texto(b.autor, 160) };
  if (tipo === "lista") return { id, tipo, itens: texto(b.itens, 4000) };
  if (tipo === "botao") return { id, tipo, rotulo: texto(b.rotulo, 80), destino: texto(b.destino, 2000) };
  if (tipo === "separador") return { id, tipo };
  return null;
}

export function lerDocumento(corpo: string): DocumentoBlog {
  const bruto = corpo.trim();
  if (bruto.startsWith("{")) {
    try {
      const json = JSON.parse(bruto) as { v?: unknown; blocos?: unknown; meta?: unknown };
      if (json && json.v === 1 && Array.isArray(json.blocos)) {
        return { v: 1, blocos: json.blocos.slice(0, 80).map(blocoDe).filter((b): b is BlocoBlog => Boolean(b)), meta: metaDe(json.meta) };
      }
    } catch {
      /* texto simples gravado antes do editor de blocos */
    }
  }
  if (!bruto) return { v: 1, blocos: [] };
  return {
    v: 1,
    blocos: bruto.split(/\n{2,}/).map(parte => parte.trim()).filter(Boolean).slice(0, 80).map(parte => ({
      id: idBloco(),
      tipo: "paragrafo" as const,
      texto: parte.slice(0, 8000),
    })),
  };
}

export function gravarDocumento(doc: DocumentoBlog) {
  const meta = doc.meta && Object.values(doc.meta).some(v => v.trim()) ? doc.meta : undefined;
  return JSON.stringify({ v: 1, blocos: doc.blocos, ...(meta ? { meta } : {}) });
}

export function textoDoCorpo(corpo: string) {
  return lerDocumento(corpo).blocos.map(bloco => {
    if (bloco.tipo === "paragrafo" || bloco.tipo === "titulo") return bloco.texto;
    if (bloco.tipo === "hero" || bloco.tipo === "seccao") return `${bloco.titulo} ${bloco.texto}`;
    if (bloco.tipo === "citacao") return bloco.texto;
    if (bloco.tipo === "lista") return bloco.itens;
    if (bloco.tipo === "imagem") return bloco.legenda;
    if (bloco.tipo === "botao") return bloco.rotulo;
    return "";
  }).join(" ").replace(/\s+/g, " ").trim();
}
