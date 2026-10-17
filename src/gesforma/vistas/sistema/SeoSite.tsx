// Sistema › Site › SEO: como o site aparece na Google, no Bing e quando é partilhado.
// Grava-se em app_settings «seo» (só o administrador); o servidor usa-o em cada página, no sitemap.xml e no robots.txt.
import { useEffect, useRef, useState } from "react";
import { apiDefinicoes, apiGravarDefinicao, apiImagemSite } from "../../../partilhado/api/site";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { AreaTexto, Aviso, Botao, Campo, Cartao, Entrada, ErroCarregar, Esqueleto, Interruptor } from "../../../partilhado/ui";

const CHAVES = [
  "indexar", "url", "nomeSite", "descricao", "imagem", "logo", "googleVerificacao", "bingVerificacao", "redesSociais",
  "inicioTitulo", "inicioDescricao", "formacaoTitulo", "formacaoDescricao",
  "noticiasTitulo", "noticiasDescricao", "empresasTitulo", "empresasDescricao",
] as const;
type Chave = typeof CHAVES[number];

const PAGINAS: { id: "inicio" | "formacao" | "noticias" | "empresas"; nome: string; caminho: string; titulo: string; descricao: string }[] = [
  { id: "inicio", nome: "Página inicial", caminho: "/", titulo: "ENA | Formação certificada", descricao: "A descrição geral do site." },
  { id: "formacao", nome: "Oferta formativa", caminho: "/formacao", titulo: "Oferta formativa", descricao: "Todos os cursos: presenciais, b-learning e e-learning…" },
  { id: "noticias", nome: "Notícias", caminho: "/noticias", titulo: "Notícias", descricao: "Novidades, eventos e artigos…" },
  { id: "empresas", nome: "Empresas", caminho: "/empresas", titulo: "Formação para empresas", descricao: "Formação à medida para equipas…" },
];

/** Igual à de server/src/seo.ts: a que o site usa enquanto não se escreve outra. */
const DESCRICAO_OMISSAO = "Formação certificada: formação de formadores (CCP), cursos autofinanciados e formação financiada.";

/** Contador com o limite que a Google mostra (o resto é cortado). */
const conta = (texto: string, ideal: number) => `${texto.length}/${ideal} caracteres${texto.length > ideal ? " · a Google corta o resto" : ""}`;

/** Como o resultado aparece na pesquisa da Google (aproximado). */
function PreviaGoogle({ url, titulo, descricao }: { url: string; titulo: string; descricao: string }) {
  return (
    <div className="rounded-md border border-linha bg-white p-3 text-left" aria-label="Pré-visualização do resultado na Google">
      <p className="m-0 truncate text-xs text-[#4d5156]">{url}</p>
      <p className="m-0 mt-0.5 truncate text-lg leading-snug text-[#1a0dab]">{titulo || "—"}</p>
      <p className="m-0 mt-0.5 line-clamp-2 text-sm text-[#4d5156]">{descricao || "—"}</p>
    </div>
  );
}

export function SeoSite() {
  const { dados, erro, recarregar } = useRecurso("definicoes", s => apiDefinicoes(s));
  const [v, setV] = useState<Record<Chave, string> | null>(null);
  const [aCarregar, setACarregar] = useState(false);
  const ficheiro = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!dados || v) return;
    const seo = dados.settings.seo ?? {};
    setV(Object.fromEntries(CHAVES.map(k => [k, String(seo[k] ?? "")])) as Record<Chave, string>);
  }, [dados, v]);
  const gravar = useAccao((valores: Record<Chave, string>) => apiGravarDefinicao("seo", valores), { ok: "SEO gravado. O site mostra-o em menos de 10 minutos.", invalidar: ["definicoes"] });

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!v) return <Esqueleto linhas={8} className="max-w-3xl" />;
  const mudar = (k: Chave, x: string) => setV({ ...v, [k]: x });
  const origem = (v.url.trim() || window.location.origin).replace(/\/+$/, "");
  const nome = v.nomeSite.trim() || "ENA";

  async function carregarImagem(f: File | undefined) {
    if (!f) return;
    setACarregar(true);
    try { mudar("imagem", (await apiImagemSite(f)).url); } finally { setACarregar(false); }
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <Aviso tom="info">
        Cada página do site é entregue à Google, ao Bing e às redes sociais já com o título, a descrição, a imagem e os dados do curso
        (preço, datas, locais). Os cursos têm título e descrição próprios na ficha do curso › Textos do site.
      </Aviso>

      <Cartao titulo="Indexação" subtitulo="Desligue num site de testes, para não aparecer na pesquisa.">
        <div className="flex flex-col gap-3">
          <Interruptor rotulo="Permitir que a Google e o Bing indexem o site" ligado={v.indexar === "1"} onMudar={x => mudar("indexar", x ? "1" : "0")} />
          {v.indexar !== "1" && <Aviso tom="aviso">O site está escondido da pesquisa (o robots.txt fecha tudo e as páginas levam «noindex»). Ligue só no domínio real: ver «SEO» na documentação do projeto (README).</Aviso>}
          <Campo rotulo="Endereço do site" ajuda="O endereço público, com https: https://ena.pt. Vazio: o endereço onde o GesForma está (só para testes).">
            {p => <Entrada {...p} type="url" value={v.url} placeholder={window.location.origin} onChange={e => mudar("url", e.target.value.trim())} />}
          </Campo>
          <p className="m-0 text-sm text-tinta-suave">
            Mapa do site: <a className="underline" href={`${origem}/sitemap.xml`} target="_blank" rel="noreferrer">{origem}/sitemap.xml<span className="sr-only"> (abre noutra janela)</span></a>
            {" · "}Regras para os robôs: <a className="underline" href={`${origem}/robots.txt`} target="_blank" rel="noreferrer">robots.txt<span className="sr-only"> (abre noutra janela)</span></a>
          </p>
        </div>
      </Cartao>

      <Cartao titulo="Identidade na pesquisa e na partilha">
        <div className="grid gap-3">
          <Campo rotulo="Nome do site" ajuda="Aparece no fim dos títulos («Curso X | ENA») e nos dados da organização.">
            {p => <Entrada {...p} maxLength={60} value={v.nomeSite} placeholder="ENA" onChange={e => mudar("nomeSite", e.target.value)} />}
          </Campo>
          <Campo rotulo="Descrição geral" ajuda={conta(v.descricao, 160)}>
            {p => <AreaTexto {...p} rows={3} maxLength={300} value={v.descricao} placeholder={DESCRICAO_OMISSAO} onChange={e => mudar("descricao", e.target.value)} />}
          </Campo>
          <Campo rotulo="Imagem de partilha" ajuda="Aparece quando se partilha uma página sem imagem própria (Facebook, LinkedIn, WhatsApp). Ideal: 1200 × 630 px. Os cursos usam a sua capa.">
            {p => (
              <div className="flex flex-wrap items-center gap-2">
                <Entrada {...p} className="min-w-0 flex-1" value={v.imagem} placeholder="/imagens/…" onChange={e => mudar("imagem", e.target.value.trim())} />
                <input ref={ficheiro} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" tabIndex={-1} onChange={e => void carregarImagem(e.target.files?.[0])} />
                <Botao aCarregar={aCarregar} onClick={() => ficheiro.current?.click()}>Carregar imagem</Botao>
              </div>
            )}
          </Campo>
          {v.imagem && <img src={v.imagem} alt="Imagem de partilha escolhida" className="max-h-40 w-fit rounded border border-linha object-contain" />}
          <Campo rotulo="Logótipo (dados da organização)" ajuda="Vazio: o logótipo da ENA no site. Quadrado ou horizontal, fundo transparente.">
            {p => <Entrada {...p} value={v.logo} placeholder="/imagens/ena-logo-nobg.png" onChange={e => mudar("logo", e.target.value.trim())} />}
          </Campo>
          <Campo rotulo="Perfis nas redes sociais" ajuda="Um endereço por linha (Facebook, Instagram, LinkedIn, YouTube…). Ajuda a Google a ligar o site à ENA.">
            {p => <AreaTexto {...p} rows={3} maxLength={400} value={v.redesSociais} placeholder={"https://www.facebook.com/…\nhttps://www.linkedin.com/company/…"} onChange={e => mudar("redesSociais", e.target.value)} />}
          </Campo>
        </div>
      </Cartao>

      <Cartao titulo="Páginas" subtitulo="Título e descrição de cada página na pesquisa. Vazio: o texto sugerido.">
        <div className="flex flex-col gap-6">
          {PAGINAS.map(pg => {
            const tk = `${pg.id}Titulo` as Chave;
            const dk = `${pg.id}Descricao` as Chave;
            const tituloFinal = v[tk].trim() || pg.titulo;
            return (
              <fieldset key={pg.id} className="m-0 flex flex-col gap-3 border-0 border-t border-linha p-0 pt-4 first:border-t-0 first:pt-0">
                <legend className="text-sm font-bold">{pg.nome}</legend>
                <Campo rotulo="Título" ajuda={conta(v[tk], 60)}>
                  {p => <Entrada {...p} maxLength={80} value={v[tk]} placeholder={pg.titulo} onChange={e => mudar(tk, e.target.value)} />}
                </Campo>
                <Campo rotulo="Descrição" ajuda={conta(v[dk], 160)}>
                  {p => <AreaTexto {...p} rows={2} maxLength={300} value={v[dk]} placeholder={pg.descricao} onChange={e => mudar(dk, e.target.value)} />}
                </Campo>
                <PreviaGoogle url={`${origem}${pg.caminho}`} titulo={pg.id === "inicio" || tituloFinal.includes(nome) ? tituloFinal : `${tituloFinal} | ${nome}`}
                  descricao={v[dk].trim() || (pg.id === "inicio" ? v.descricao.trim() || DESCRICAO_OMISSAO : pg.descricao)} />
              </fieldset>
            );
          })}
        </div>
      </Cartao>

      <Cartao titulo="Google Search Console e Bing Webmaster Tools" subtitulo="Confirmam à Google e ao Bing (Edge) que o site é da ENA e mostram como aparece na pesquisa.">
        <div className="grid gap-3">
          <ol className="m-0 list-decimal space-y-1 pl-5 text-[13px] text-tinta-suave">
            <li>Em search.google.com/search-console, adicione o site como «Prefixo do URL» e escolha a verificação por «Etiqueta HTML».</li>
            <li>Cole a etiqueta (ou só o código) abaixo, grave, espere 10 minutos e carregue em «Verificar».</li>
            <li>Em «Sitemaps», submeta {origem}/sitemap.xml. No Bing (bing.com/webmasters) pode importar o site da Search Console.</li>
          </ol>
          <Campo rotulo="Verificação da Google" ajuda="A etiqueta <meta name=&quot;google-site-verification&quot; …> ou só o código.">
            {p => <Entrada {...p} maxLength={300} value={v.googleVerificacao} onChange={e => mudar("googleVerificacao", e.target.value)} />}
          </Campo>
          <Campo rotulo="Verificação do Bing" ajuda="A etiqueta <meta name=&quot;msvalidate.01&quot; …> ou só o código.">
            {p => <Entrada {...p} maxLength={300} value={v.bingVerificacao} onChange={e => mudar("bingVerificacao", e.target.value)} />}
          </Campo>
        </div>
      </Cartao>

      <div><Botao variante="primario" aCarregar={gravar.aCorrer} onClick={() => void gravar.correr(v)}>Gravar SEO</Botao></div>
    </div>
  );
}
