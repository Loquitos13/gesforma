// Serviços para empresas (escritos em Gestão › Empresas / Business): os mesmos dados servem os cartões do bloco
// «Serviços» e a página de cada serviço (/empresas/<slug>), no site e no servidor (validação, SEO, sitemap).

export type ImagemServico = { imagem: string; legenda: string };
export type LogoServico = { imagem: string; alt: string; ligacao: string };

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
};

const slugify = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const slugServico = (s: Pick<ServicoSite, "slug" | "titulo">) => slugify(s.slug?.trim() || s.titulo || "");

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
