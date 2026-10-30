// Serviços para empresas (escritos em Gestão › Empresas / Business): os mesmos dados servem os cartões do bloco
// «Serviços» e a página de cada serviço (/empresas/<slug>), no site e no servidor (validação, SEO, sitemap).

export type ImagemServico = { imagem: string; legenda: string };
export type LogoServico = { imagem: string; alt: string; ligacao: string };
/** Cartão da página do serviço; com ligação, leva a outra página (ex.: na Certifica, um cartão por serviço «dentro» dela). */
export type CartaoServico = { titulo: string; texto: string; rotulo?: string; ligacao?: string };

export type ServicoSite = {
  imagem: string; etiqueta: string; titulo: string; texto: string; pontos: string; rotulo: string; ligacao: string;
  /** Endereço da página (/empresas/<slug>). */
  slug?: string;
  /** Texto da página do serviço (vazio = o texto do cartão). */
  detalhe?: string;
  imagens?: ImagemServico[];
  /** YouTube, Vimeo ou um ficheiro de vídeo (https). */
  video?: string;
  logos?: LogoServico[];
  /** Imagem do topo da página do serviço (à direita). */
  capa?: string;
  /** Título do texto completo (vazio = o do bloco, ex.: «Sobre o serviço»). */
  tituloDetalhe?: string;
  /** Cartões da página (ex.: vantagens ou passos). */
  cartoes?: CartaoServico[];
  /** Faixa final (vazio = o texto do bloco). */
  ctaTitulo?: string;
  ctaTexto?: string;
  /** Serviço «dentro» de outro (endereço do outro): fora dos cartões da página Empresas; o «Voltar» leva à página dele. */
  pai?: string;
};

/**
 * Tamanho máximo (caracteres) de cada texto: o servidor valida com estes e o backoffice conta com estes (contador
 * «n / máx.» e aviso quando chega ao limite), para o que se escreve caber sempre no que se grava.
 */
export const LIMITES_SERVICO = {
  titulo: 120, etiqueta: 40, texto: 1200, pontos: 1200, detalhe: 12000, rotulo: 40, ligacao: 300, video: 500,
  legenda: 200, logoNome: 120, tituloDetalhe: 160, cartaoTitulo: 120, cartaoTexto: 2000, cartaoRotulo: 40,
  ctaTitulo: 160, ctaTexto: 1200, slug: 80,
} as const;

/** Os serviços que aparecem nos cartões da página Empresas: os que não estão dentro de outro serviço ativo. */
export const servicosDeTopo = <T extends Pick<ServicoSite, "slug" | "titulo" | "pai">>(lista: T[]) => {
  // Só um nível: um serviço fica escondido se a página-mãe existir e estiver ela própria nos cartões (sem mãe).
  // Assim, uma mãe posta por engano dentro de uma das filhas não faz desaparecer as três.
  const deTopo = new Set(lista.filter(s => !s.pai).map(s => slugServico(s)));
  return lista.filter(s => !s.pai || !deTopo.has(s.pai));
};

/** Textos de um cartão escritos só na página Empresas (bloco «Serviços», campo «porServico» no editor do site). */
export type TextosProprios = { titulo?: string; texto?: string; pontos?: string };

/**
 * Os textos que a página Empresas (JSON do editor do site) escreve por cima dos do backoffice para este serviço:
 * só os não vazios, que são os que o site mostra em vez dos de Gestão › Empresas / Business. Null = nenhum.
 */
export function textosProprios(pagina: unknown, slug: string): TextosProprios | null {
  let achado: TextosProprios | null = null;
  const ver = (no: unknown, fundo: number) => {
    if (achado || !no || typeof no !== "object" || fundo > 30) return;
    if (Array.isArray(no)) { for (const x of no) ver(x, fundo + 1); return; }
    const o = no as { type?: unknown; props?: { porServico?: unknown } };
    if (o.type === "Servicos" && Array.isArray(o.props?.porServico)) {
      // Como o bloco: conta a primeira linha deste serviço.
      const it = (o.props.porServico as (Record<string, unknown> | null)[]).find(x => x && x.slug === slug);
      if (it) {
        const r: TextosProprios = {};
        for (const k of ["titulo", "texto", "pontos"] as const) if (typeof it[k] === "string" && (it[k] as string).trim()) r[k] = it[k] as string;
        if (Object.keys(r).length) { achado = r; return; }
      }
    }
    for (const v of Object.values(no)) ver(v, fundo + 1);
  };
  ver(pagina, 0);
  return achado;
}

const slugify =(s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const slugServico = (s: Pick<ServicoSite, "slug" | "titulo">) => slugify(s.slug?.trim() || s.titulo || "");

/** Vídeo de apresentação do curso: o mesmo que o dos serviços, e também só o ID do YouTube (11 caracteres). */
export function videoDoCurso(v: string | undefined) {
  const u = (v ?? "").trim();
  return /^[\w-]{11}$/.test(u) ? videoServico(`https://www.youtube.com/watch?v=${u}`) : videoServico(u);
}

/** Vídeo para incorporar: YouTube e Vimeo (sem cookies de rastreio) ou um ficheiro https. */
export function videoServico(url: string | undefined): { tipo: "iframe" | "video"; src: string } | null {
  const u = (url ?? "").trim();
  if (!/^https:\/\//i.test(u)) return null;
  const yt = /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,20})/i.exec(u);
  if (yt) return { tipo: "iframe", src: `https://www.youtube-nocookie.com/embed/${yt[1]}` };
  const vimeo = /vimeo\.com\/(?:video\/)?(\d{5,12})/i.exec(u);
  if (vimeo) return { tipo: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}?dnt=1` };
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) return { tipo: "video", src: u };
  return null;
}
