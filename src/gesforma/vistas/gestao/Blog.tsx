// Gestão › Blog: publicações (notícias do site) e temáticas.
import { useState } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import { apiApagarPost, apiCriarPost, apiEditarPost, apiPosts, type Post } from "../../../partilhado/api/blog";
import { LIMITE_CORPO_BLOG } from "../../../partilhado/blogBlocos";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import {
  Aviso, Botao, Cartao, ConfirmarPerigo, ErroCarregar, Estado, Filtros, PageHeader, PainelLateral, Separadores, Tabela, Vazio, data, useFiltrosUrl, type Coluna,
} from "../../../partilhado/ui";
import { EditorBlog } from "../../EditorBlog";
import type { VistaProps } from "../../shell/tipos";
import { CatalogoTabela, type ConfigCatalogo } from "../cursos/CatalogoTabela";

const slugDe = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ativo = (s: string) => !/^(inactiv|inativ)/i.test(s);

export default function Blog({ view, navigate }: VistaProps) {
  const tab = view === "blog-tematicas" ? "tematicas" : "posts";
  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: "Gestão" }, { rotulo: "Blog" }, { rotulo: tab === "posts" ? "Publicações" : "Temáticas" }]}
        titulo="Blog"
        subtitulo="Notícias da página pública da ENA. Só as publicações activas aparecem no site."
      />
      <Separadores
        rotulo="Blog"
        itens={[{ id: "posts", rotulo: "Publicações" }, { id: "tematicas", rotulo: "Temáticas" }]}
        ativo={tab}
        onMudar={id => navigate(id === "posts" ? "blog-posts" : "blog-tematicas")}
      />
      {tab === "posts" ? <Publicacoes /> : <Tematicas />}
    </div>
  );
}

function Publicacoes() {
  const pode = usePode()("blog.gerir");
  const [f, setF, limpar] = useFiltrosUrl({ q: "", estado: "", tematica: "", ordem: "-data" });
  const chave = `blog:${JSON.stringify(f)}`;
  const { dados, erro, aCarregar, recarregar } = useRecurso(chave, signal => apiPosts(f, signal));
  const tematicas = useOpcoes("tematicas", { todos: true });
  const [aberto, setAberto] = useState<Post | "novo" | null>(null);
  const [apagar, setApagar] = useState<Post | null>(null);
  const apagarAccao = useAccao(apiApagarPost, { ok: "Publicação eliminada.", invalidar: ["blog:", "catalogo:blog_tematicas"] });
  const nFiltros = [f.q, f.estado, f.tematica].filter(Boolean).length;

  const colunas: Coluna<Post>[] = [
    { id: "titulo", titulo: "Título", principal: true, ordenavel: true, celula: p => <span className="font-semibold">{p.titulo}</span> },
    { id: "slug", titulo: "Endereço", esconderMovel: true, celula: p => <span className="font-mono text-xs text-tinta-suave">/noticias/{p.slug}</span> },
    { id: "tematica", titulo: "Temática", esconderMovel: true, celula: p => p.tematica || "—" },
    { id: "data", titulo: "Data", ordenavel: true, celula: p => data(p.data) },
    { id: "estado", titulo: "Estado", ordenavel: true, celula: p => <Estado tom={ativo(p.status) ? "sucesso" : "neutro"} ponto>{ativo(p.status) ? "No site" : "Inactivo"}</Estado> },
  ];

  return (
    <div className="space-y-4">
      <Filtros
        pesquisa={{ valor: f.q, onMudar: v => setF({ q: v }), placeholder: "Pesquisar título ou endereço…" }}
        selecoes={[
          { chave: "tematica", rotulo: "Temática", vazio: "Todas as temáticas", opcoes: tematicas.selecao, valor: f.tematica, onMudar: v => setF({ tematica: v }) },
          { chave: "estado", rotulo: "Estado", vazio: "Todos", opcoes: [{ valor: "Ativo", rotulo: "No site" }, { valor: "Inactivo", rotulo: "Inactivos" }], valor: f.estado, onMudar: v => setF({ estado: v }) },
        ]}
        ativos={nFiltros}
        onLimpar={limpar}
        extra={(
          <div className="ml-auto flex items-center gap-2">
            {dados && <span className="num text-[13px] text-tinta-suave">{dados.resumo.total} publicações · {dados.resumo.ativos} no site</span>}
            {pode && <Botao variante="primario" onClick={() => setAberto("novo")}>Nova publicação</Botao>}
          </div>
        )}
      />
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : (
        <Cartao semPadding>
          <Tabela
            rotulo="Publicações do blog"
            linhas={dados?.posts ?? []}
            colunas={colunas}
            chave={p => p.id}
            ordem={f.ordem}
            onOrdenar={o => setF({ ordem: o })}
            aCarregar={aCarregar}
            onLinha={pode ? p => setAberto(p) : undefined}
            acoesLinha={p => (
              <div className="flex justify-end gap-1">
                {ativo(p.status) && <a className="inline-flex h-8 items-center px-2 text-[13px] font-semibold text-ligacao hover:underline" href={`/noticias/${p.slug}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>Ver no site</a>}
                {pode && <Botao tamanho="sm" variante="fantasma" onClick={e => { e.stopPropagation(); setApagar(p); }}>Eliminar</Botao>}
              </div>
            )}
            vazio={<Vazio titulo={nFiltros ? "Nenhuma publicação corresponde aos filtros." : "Ainda não há publicações."} acao={nFiltros ? <Botao onClick={limpar}>Limpar filtros</Botao> : undefined} />}
          />
        </Cartao>
      )}
      {aberto && <EditorPublicacao post={aberto === "novo" ? null : aberto} onFechar={() => setAberto(null)} />}
      <ConfirmarPerigo
        aberto={Boolean(apagar)}
        onFechar={() => setApagar(null)}
        titulo="Eliminar publicação"
        descricao={apagar ? `«${apagar.titulo}» sai do site e não se recupera. Para manter o histórico, marque-a como inactiva.` : ""}
        onConfirmar={async () => { if (apagar) { await apagarAccao.correr(apagar.id); setApagar(null); } }}
      />
    </div>
  );
}

function EditorPublicacao({ post, onFechar }: { post: Post | null; onFechar: () => void }) {
  const [titulo, setTitulo] = useState(post?.titulo ?? "");
  const [slug, setSlug] = useState(post?.slug ?? "");
  const [tematica, setTematica] = useState(post?.tematica ?? "");
  const [estado, setEstado] = useState(post?.status || "Ativo");
  const [corpo, setCorpo] = useState(post?.corpo ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const gravar = useAccao(
    (d: Omit<Post, "id">) => (post ? apiEditarPost(post.id, d) : apiCriarPost(d)),
    { ok: post ? "Publicação gravada." : "Publicação criada.", invalidar: ["blog:", "catalogo:blog_tematicas"] },
  );

  async function submeter() {
    const slugFinal = slugDe(slug.trim() || titulo);
    if (!titulo.trim()) { setErro("Escreva o título."); return; }
    if (!slugFinal) { setErro("O endereço tem de ter letras ou números."); return; }
    if (corpo.length > LIMITE_CORPO_BLOG) { setErro("O artigo é demasiado longo."); return; }
    const r = await gravar.correr({ titulo: titulo.trim(), slug: slugFinal, tematica, status: estado, corpo, data: post?.data || new Date().toISOString().slice(0, 10) });
    if (r) onFechar();
  }

  return (
    <PainelLateral
      aberto
      onFechar={onFechar}
      largura={880}
      titulo={post ? "Editar publicação" : "Nova publicação"}
      subtitulo={post ? `Publicada a ${data(post.data)}` : "Aparece no site quando estiver activa."}
      rodape={(
        <div className="flex justify-end gap-2">
          <Botao variante="secundario" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" aCarregar={gravar.aCorrer} onClick={() => void submeter()}>{post ? "Guardar" : "Publicar"}</Botao>
        </div>
      )}
    >
      {erro && <Aviso tom="perigo" className="mb-3">{erro}</Aviso>}
      <EditorBlog
        chave={post ? String(post.id) : "novo"}
        corpoInicial={corpo}
        onCorpo={setCorpo}
        titulo={titulo}
        slug={slug}
        tematica={tematica}
        estado={estado}
        onTitulo={v => { setTitulo(v); setErro(null); }}
        onSlug={setSlug}
        onTematica={setTematica}
        onEstado={setEstado}
      />
    </PainelLateral>
  );
}

const CONFIG_TEMATICAS: ConfigCatalogo = {
  kind: "blog_tematicas", regime: "gold", singular: "temática", plural: "temáticas", campoEstado: "estado", capacidade: "blog.gerir",
  rotulo: i => String(i.nome ?? ""),
  pesquisa: i => `${String(i.nome ?? "")} ${String(i.slug ?? "")}`,
  campos: [
    { chave: "nome", rotulo: "Nome", obrigatorio: true },
    { chave: "slug", rotulo: "Endereço", ajuda: "Vazio: gera-se do nome." },
  ],
  completar: v => ({ ...v, slug: slugDe(String(v.slug ?? "") || String(v.nome ?? "")) }),
  validar: (v, itens, id) => (itens.some(i => i.id !== id && String(i.nome ?? "").trim().toLowerCase() === String(v.nome ?? "").trim().toLowerCase()) ? "Já existe uma temática com esse nome." : null),
  colunas: [
    { id: "nome", titulo: "Temática", principal: true, celula: i => <span className="font-semibold">{String(i.nome ?? "")}</span> },
    { id: "slug", titulo: "Endereço", esconderMovel: true, celula: i => <span className="font-mono text-xs text-tinta-suave">{String(i.slug ?? "") || "—"}</span> },
  ],
  nota: <p className="m-0 text-[13px] text-tinta-suave">Mudar o nome de uma temática actualiza as publicações que a usam.</p>,
};

function Tematicas() {
  return <CatalogoTabela config={CONFIG_TEMATICAS} />;
}
