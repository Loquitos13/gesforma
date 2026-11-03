// Páginas do site feitas no editor visual: nomes dos blocos e validação do JSON (servidor e browser).

export const PAGINAS_SITE = ["inicio", "moldura", "catalogo", "curso", "noticias", "noticia", "empresas", "servico", "area"] as const;
export type PaginaFixa = typeof PAGINAS_SITE[number];
/** As páginas fixas e as páginas livres («livre-sobre-nos» está no site em /sobre-nos). */
export type PaginaSite = PaginaFixa | `livre-${string}`;

/** Endereço de uma página livre: letras minúsculas, números e hífenes (ex.: «sobre-nos»). */
export const ENDERECO_LIVRE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** Endereços que o site já usa (não podem ser páginas livres). */
export const ENDERECOS_RESERVADOS = new Set([
  "formacao", "noticias", "empresas", "gesforma", "entrar", "area-formando", "pre-inscricao", "documentos", "documentos-formando",
  "cronograma", "assinar", "verificar", "faturacao", "inquerito", "api", "imagens", "assets", "sitemap.xml", "robots.txt",
]);

export const paginaLivre = (endereco: string) => `livre-${endereco}` as const;
export const enderecoDaLivre = (pagina: string) => (pagina.startsWith("livre-") ? pagina.slice("livre-".length) : "");
export const eFixa = (p: string): p is PaginaFixa => (PAGINAS_SITE as readonly string[]).includes(p);

/** Página fixa ou livre com um endereço válido e não reservado. */
export function paginaValida(p: string): p is PaginaSite {
  if (eFixa(p)) return true;
  const e = enderecoDaLivre(p);
  return Boolean(e) && e.length <= 60 && ENDERECO_LIVRE.test(e) && !ENDERECOS_RESERVADOS.has(e);
}

export const BLOCOS_SITE = [
  "Cabecalho", "Rodape", "Seccao", "Coluna", "Titulo", "Texto", "Botao", "Imagem", "Espaco", "Separador",
  "Pilares", "Servicos", "Testemunhos", "Logotipos", "CursosDestaque", "OfertaFormativa", "Catalogo", "DetalheCurso", "ListaNoticias", "AreaFormando",
  "CursoBanner", "CursoSintese", "CursoDados", "CursoObjetivos", "CursoPrograma", "CursoFuncionamento", "CursoTurmas", "CursoRelevantes", "CursoInscricao",
  "CursoEscolhaLocal", "CursoTexto", "CursoImagem", "CursoBotaoInscricao", "CursoVideo",
  "ServicoBanner", "ServicoDetalhe", "ServicoGaleria", "ServicoVideo", "ServicoLogos", "ServicoCartoes", "ServicoChamada", "FormularioProposta",
  "NoticiaCabecalho", "NoticiaCorpo", "NoticiaOutras", "NoticiaImagem", "NoticiaCurso", "RedesSociais", "Mapa",
] as const;

export type BlocoSite = typeof BLOCOS_SITE[number];
const NOMES = new Set<string>(BLOCOS_SITE);
const TAMANHO_MAX = 1_500_000;
const PROFUNDIDADE_MAX = 40;
const TEXTO_MAX = 20_000;

/** Verifica a forma do JSON de uma página: blocos conhecidos, profundidade e tamanhos limitados. */
export function validarPaginaSite(dados: unknown): { ok: true } | { ok: false; erro: string } {
  if (!dados || typeof dados !== "object" || Array.isArray(dados)) return { ok: false, erro: "página inválida" };
  const d = dados as { root?: unknown; content?: unknown };
  if (!Array.isArray(d.content)) return { ok: false, erro: "página sem conteúdo" };
  if (JSON.stringify(dados).length > TAMANHO_MAX) return { ok: false, erro: "a página é demasiado grande" };
  let erro = "";
  const visitar = (v: unknown, nivel: number) => {
    if (erro) return;
    if (nivel > PROFUNDIDADE_MAX) { erro = "a página tem demasiados níveis"; return; }
    if (typeof v === "string") { if (v.length > TEXTO_MAX) erro = "há um texto demasiado longo"; return; }
    if (Array.isArray(v)) { for (const x of v) visitar(x, nivel + 1); return; }
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.type === "string" && o.props && typeof o.props === "object" && !NOMES.has(o.type)) {
        erro = `bloco desconhecido: ${o.type.slice(0, 40)}`;
        return;
      }
      for (const x of Object.values(o)) visitar(x, nivel + 1);
    }
  };
  visitar(dados, 0);
  return erro ? { ok: false, erro } : { ok: true };
}
