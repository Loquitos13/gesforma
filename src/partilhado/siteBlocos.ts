// Páginas do site feitas no editor visual: nomes dos blocos e validação do JSON (servidor e browser).

export const PAGINAS_SITE = ["inicio", "catalogo", "curso", "noticias", "empresas", "area"] as const;
export type PaginaSite = typeof PAGINAS_SITE[number];

export const BLOCOS_SITE = [
  "Cabecalho", "Rodape", "Seccao", "Coluna", "Titulo", "Texto", "Botao", "Imagem", "Espaco", "Separador",
  "Pilares", "Logotipos", "CursosDestaque", "OfertaFormativa", "Catalogo", "DetalheCurso", "ListaNoticias", "AreaFormando",
  "CursoBanner", "CursoSintese", "CursoDados", "CursoObjetivos", "CursoPrograma", "CursoTurmas", "CursoInscricao",
  "CursoEscolhaLocal", "CursoTexto", "CursoImagem", "CursoBotaoInscricao",
] as const;

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
