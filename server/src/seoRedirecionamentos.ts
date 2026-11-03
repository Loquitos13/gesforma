/**
 * Endereços do site antigo da ENA (que a Google tem indexados) → endereços do site novo, com 301 para não se perder
 * a posição na pesquisa. Uma página livre publicada com o mesmo endereço (Sistema › Site) ganha sempre.
 *   /formacao/curso/<slug> → /formacao/<curso>     /blog[/<slug>] → /noticias[/<slug>]
 *   /sobre-nos, /contactos → /#onde-estamos         landings antigas (/formacao-de-formadores-ccp…) → o curso
 *   /politica-de-privacidade, /termos-e-condicoes → o site antigo (antigo.ena.pt), até haver página livre.
 */
import type { Db } from "./db/pool.js";
import { listarCatalogoPublico } from "./catalogoPublico.js";
import { noticiaPublica } from "./repos/blog.js";
import { lerPublicada } from "./repos/sitePaginas.js";
import { ENDERECOS_RESERVADOS } from "../../src/partilhado/siteBlocos.js";

export type Redirecionamento = { para: string; estado: 301 | 302 };

const SITE_ANTIGO = "https://antigo.ena.pt";
const LEGAIS = new Set(["politica-de-privacidade", "termos-e-condicoes"]);
const CONTACTOS = new Set(["sobre-nos", "contactos", "contacto", "onde-estamos"]);
const PALAVRAS_VAZIAS = new Set(["de", "da", "do", "e", "a", "o", "em", "para", "curso", "formacao"]);

const palavras = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(p => p && !PALAVRAS_VAZIAS.has(p));

/** O curso do catálogo cujo endereço mais se parece com o antigo (pelo menos duas palavras em comum, ou igual). */
async function cursoParecido(db: Db, slug: string) {
  const { cursos } = await listarCatalogoPublico(db);
  const exato = cursos.find(c => c.id === slug);
  if (exato) return exato.id;
  const alvo = new Set(palavras(slug));
  let melhor: { id: string; n: number } | null = null;
  for (const c of cursos) {
    const n = new Set([...palavras(c.id), ...palavras(c.titulo)].filter(p => alvo.has(p))).size;
    if (n >= Math.min(2, alvo.size) && (!melhor || n > melhor.n)) melhor = { id: c.id, n };
  }
  return melhor?.id ?? null;
}

export async function redirecionamentoAntigo(db: Db, caminhoBruto: string): Promise<Redirecionamento | null> {
  const caminho = (`/${caminhoBruto.split("?")[0]!.replace(/^\/+/, "")}`).replace(/\/+$/, "") || "/";
  const partes = caminho.split("/").filter(Boolean).map(p => decodeURIComponent(p).toLowerCase());
  if (!partes.length) return null;

  if (partes[0] === "formacao" && partes[1] === "curso") {
    const id = partes[2] ? await cursoParecido(db, partes[2]) : null;
    return { para: id ? `/formacao/${id}` : "/formacao", estado: 301 };
  }
  if (partes[0] === "blog") {
    if (partes[1] && /^[a-z0-9-]{1,160}$/.test(partes[1]) && await noticiaPublica(db, partes[1]).catch(() => null)) {
      return { para: `/noticias/${partes[1]}`, estado: 301 };
    }
    return { para: "/noticias", estado: 301 };
  }
  if (partes.length !== 1) return null;
  const um = partes[0]!;
  // Endereços do site novo (formação, notícias, área do formando, pré-inscrição…) nunca se redirecionam.
  if (ENDERECOS_RESERVADOS.has(um) || ["noticias", "empresas", "pagamento", "obrigado"].includes(um)) return null;
  // Uma página livre com este endereço ganha a qualquer regra.
  if (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(um) && await lerPublicada(db, `livre-${um}`).catch(() => null)) return null;
  if (CONTACTOS.has(um)) return { para: "/#onde-estamos", estado: 301 };
  if (LEGAIS.has(um)) return { para: `${SITE_ANTIGO}/${um}`, estado: 302 };
  if (um === "e-learning") return { para: "/formacao", estado: 301 };
  // Landings antigas de cursos (/formacao-de-formadores-ccp, /espanhol-inicial…).
  if (/^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(um)) {
    const id = await cursoParecido(db, um);
    if (id) return { para: `/formacao/${id}`, estado: 301 };
  }
  return null;
}
