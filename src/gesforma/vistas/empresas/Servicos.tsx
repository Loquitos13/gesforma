// Gestão › Empresas / Business: os serviços para empresas. Cada um aparece num cartão do bloco «Serviços» da página
// Empresas e tem página própria no site (/empresas/<endereço>), desenhada uma vez em Sistema › Site › «Página de serviço».
import { useState, type ClipboardEvent, type ReactNode } from "react";
import {
  apiApagarServico, apiCriarServico, apiGravarServico, apiImagemSite, apiPaginaSite, apiServicos, type DadosServico, type GravarServico, type Servico,
} from "../../../partilhado/api/site";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { LIMITES_SERVICO as L, slugServico, textosProprios, videoServico, type TextosProprios } from "../../../partilhado/siteServicos";
import { TextoFormatado } from "../../../partilhado/TextoFormatado";
import { AJUDA_FORMATACAO, htmlParaTexto, normalizarColagem } from "../../../partilhado/textoFormatado";
import {
  AreaTexto, Aviso, Botao, Campo, Cartao, ConfirmarPerigo, Entrada, ErroCarregar, Esqueleto, Estado, Interruptor, PageHeader, PainelLateral, Selecao, Separadores,
} from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { PedidosProposta } from "./PedidosProposta";

const VAZIO: DadosServico = {
  titulo: "", etiqueta: "", texto: "", pontos: "", detalhe: "", rotulo: "Pedir proposta", ligacao: "#contactos",
  imagem: "", imagens: [], video: "", logos: [], capa: "", tituloDetalhe: "", cartoes: [], ctaTitulo: "", ctaTexto: "", pai: "",
};

type Edicao = { id: number | null; slug: string; ativo: boolean; ordem?: number; dados: DadosServico };

export default function ServicosEmpresas(_props: VistaProps) {
  const { dados, erro, recarregar } = useRecurso("servicos", s => apiServicos(s));
  const [separador, setSeparador] = useState<"pedidos" | "servicos">("pedidos");
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [apagar, setApagar] = useState<Servico | null>(null);
  const gravar = useAccao((e: Edicao) => {
    const corpo: GravarServico = { slug: e.slug, ativo: e.ativo, ordem: e.ordem, dados: e.dados };
    return e.id == null ? apiCriarServico(corpo) : apiGravarServico(e.id, corpo);
  }, { ok: "Serviço gravado. O site mostra-o de imediato.", invalidar: ["servicos"] });
  const tirar = useAccao(apiApagarServico, { ok: "Serviço apagado.", invalidar: ["servicos"] });
  const lista = dados?.servicos ?? [];

  // Trocar a posição com o vizinho (as duas gravações levam a ordem uma da outra).
  async function mover(i: number, sentido: -1 | 1) {
    const a = lista[i], b = lista[i + sentido];
    if (!a || !b) return;
    const ordemA = a.ordem === b.ordem ? a.ordem + sentido : b.ordem;
    await apiGravarServico(a.id, { slug: a.slug, ativo: a.ativo, ordem: ordemA, dados: a.dados });
    await gravar.correr({ id: b.id, slug: b.slug, ativo: b.ativo, ordem: a.ordem, dados: b.dados });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader titulo="Empresas / Business" subtitulo="Serviços para empresas: cartões na página Empresas e uma página para cada um no site."
        acoes={separador === "servicos" ? <Botao variante="primario" onClick={() => setEdicao({ id: null, slug: "", ativo: true, dados: { ...VAZIO } })}>Novo serviço</Botao> : undefined} />
      <Separadores<"pedidos" | "servicos"> rotulo="Empresas / Business" ativo={separador} onMudar={setSeparador}
        itens={[{ id: "pedidos", rotulo: "Pedidos de proposta" }, { id: "servicos", rotulo: "Serviços" }]} />
      {separador === "pedidos" ? <PedidosProposta /> : (<>
      <Aviso tom="info">
        O aspeto dos cartões e da página de cada serviço (ordem dos blocos, cores, espaços) muda-se em Sistema › Site:
        página «Empresas» (bloco «Serviços») e «Página de serviço». Aqui escreve-se o conteúdo.
      </Aviso>
      {erro ? <ErroCarregar erro={erro} onTentar={recarregar} /> : !dados ? <Esqueleto linhas={6} /> : lista.length === 0 ? (
        <Cartao><p className="m-0 text-sm text-tinta-suave">Ainda não há serviços. Crie o primeiro em «Novo serviço».</p></Cartao>
      ) : (
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {lista.map((s, i) => (
            <li key={s.id}>
              <Cartao>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex flex-col">
                    <button type="button" className="px-1 text-tinta-suave hover:text-tinta disabled:opacity-25" disabled={i === 0 || gravar.aCorrer} onClick={() => void mover(i, -1)} aria-label={`Subir «${s.dados.titulo}»`}>▲</button>
                    <button type="button" className="px-1 text-tinta-suave hover:text-tinta disabled:opacity-25" disabled={i === lista.length - 1 || gravar.aCorrer} onClick={() => void mover(i, 1)} aria-label={`Descer «${s.dados.titulo}»`}>▼</button>
                  </div>
                  {s.dados.imagem && <img src={s.dados.imagem} alt="" className="h-10 w-10 object-contain" />}
                  <div className="min-w-0 flex-1">
                    <p className="m-0 font-semibold">{s.dados.titulo}</p>
                    {s.dados.pai && <p className="m-0 text-xs text-tinta-suave">Dentro de «{lista.find(x => x.slug === s.dados.pai)?.dados.titulo ?? s.dados.pai}» (não aparece nos cartões da página Empresas)</p>}
                    <p className="m-0 truncate text-sm text-tinta-suave">{s.dados.texto}</p>
                    <p className="m-0 mt-1 flex flex-wrap gap-x-3 text-xs text-tinta-suave">
                      <span>{(s.dados.imagens ?? []).length} imagens</span>
                      <span>{s.dados.video ? "com vídeo" : "sem vídeo"}</span>
                      <span>{(s.dados.logos ?? []).length} logótipos</span>
                    </p>
                  </div>
                  <Estado tom={s.ativo ? "sucesso" : "neutro"} ponto>{s.ativo ? "No site" : "Escondido"}</Estado>
                  {s.ativo && <a className="text-sm underline" href={`/empresas/${s.slug}`} target="_blank" rel="noreferrer">Ver no site<span className="sr-only"> (abre noutra janela)</span></a>}
                  <Botao onClick={() => setEdicao({ id: s.id, slug: s.slug, ativo: s.ativo, ordem: s.ordem, dados: { ...VAZIO, ...s.dados } })}>Editar</Botao>
                  <Botao variante="fantasma" onClick={() => setApagar(s)}>Apagar</Botao>
                </div>
              </Cartao>
            </li>
          ))}
        </ol>
      )}
      {edicao && (
        <FormServico inicial={edicao} outros={lista.filter(s => s.id !== edicao.id && !s.dados.pai)} aGravar={gravar.aCorrer} onFechar={() => setEdicao(null)}
          onGravar={async e => { if (await gravar.correr(e)) setEdicao(null); }} />
      )}
      <ConfirmarPerigo aberto={apagar != null} onFechar={() => setApagar(null)} titulo={`Apagar «${apagar?.dados.titulo ?? ""}»?`} acao="Apagar"
        descricao="Sai da página Empresas e a página do serviço deixa de existir. Para o tirar só por uns tempos, use «Mostrar no site» (desligado)."
        onConfirmar={async () => { if (apagar) await tirar.correr(apagar.id); setApagar(null); }} />
      </>)}
    </div>
  );
}

function FormServico({ inicial, outros, aGravar, onFechar, onGravar }: { inicial: Edicao; outros: Servico[]; aGravar: boolean; onFechar: () => void; onGravar: (e: Edicao) => void }) {
  const [e, setE] = useState<Edicao>(inicial);
  const d = e.dados;
  const mudar = (p: Partial<DadosServico>) => setE({ ...e, dados: { ...d, ...p } });
  const slug = slugServico({ slug: e.slug, titulo: d.titulo });
  // Textos deste cartão escritos na página Empresas (editor do site): passam à frente dos daqui.
  const { dados: paginaEmpresas } = useRecurso(inicial.id != null ? "site-pagina-empresas" : null, sinal => apiPaginaSite("empresas", sinal));
  const proprios = paginaEmpresas && slug ? { publicado: textosProprios(paginaEmpresas.publicado, slug), rascunho: textosProprios(paginaEmpresas.rascunho, slug) } : null;
  const videoMau = Boolean(d.video?.trim()) && !videoServico(d.video);

  return (
    <PainelLateral aberto onFechar={onFechar} largura={680} titulo={inicial.id == null ? "Novo serviço" : d.titulo || "Serviço"}
      subtitulo={slug ? `Página: /empresas/${slug}` : "Escreva o título"}
      rodape={(
        <div className="flex justify-end gap-2">
          <Botao variante="fantasma" onClick={onFechar}>Cancelar</Botao>
          <Botao variante="primario" aCarregar={aGravar} disabled={!d.titulo.trim() || videoMau} onClick={() => onGravar(e)}>Gravar</Botao>
        </div>
      )}>
      <div className="flex flex-col gap-5">
        <Interruptor rotulo="Mostrar no site" ligado={e.ativo} onMudar={ativo => setE({ ...e, ativo })} />
        <Campo rotulo="Dentro de outro serviço" ajuda="Ex.: «Certificação Inicial» dentro da Certifica. Não aparece nos cartões da página Empresas e o «Voltar» da página leva à página escolhida. Para lá aparecer, acrescente nessa página um cartão com ligação a esta.">
          {p => (
            <Selecao {...p} value={d.pai ?? ""} onChange={x => mudar({ pai: x.target.value })} vazio="Nenhum (cartão na página Empresas)"
              opcoes={[
                ...(d.pai && !outros.some(o => o.slug === d.pai) ? [{ valor: d.pai, rotulo: d.pai }] : []),
                ...outros.map(o => ({ valor: o.slug, rotulo: o.dados.titulo })),
              ]} />
          )}
        </Campo>

        <Grupo titulo="Cartão na página Empresas">
          {(proprios?.publicado || proprios?.rascunho) && <AvisoTextosProprios publicado={proprios.publicado} rascunho={proprios.rascunho} />}
          <Campo rotulo="Título" obrigatorio>{p => <Entrada {...p} maxLength={L.titulo} value={d.titulo} onChange={x => mudar({ titulo: x.target.value })} />}</Campo>
          <Campo rotulo="Etiqueta" ajuda="Opcional, por cima do título (ex.: «Mais procurado»).">{p => <Entrada {...p} maxLength={L.etiqueta} value={d.etiqueta} onChange={x => mudar({ etiqueta: x.target.value })} />}</Campo>
          <CampoTexto rotulo="Descrição curta" ajuda="No cartão e no topo da página do serviço (toda, com os parágrafos)." linhas={4} max={L.texto} valor={d.texto ?? ""} onMudar={texto => mudar({ texto })} previa />
          <CampoTexto rotulo="Pontos" ajuda="Um por linha (lista com visto). As marcas coladas («- », «•») saem." linhas={3} max={L.pontos} valor={d.pontos ?? ""} onMudar={pontos => mudar({ pontos })} />
          <p className="m-0 text-xs text-tinta-suave">{AJUDA_FORMATACAO} Colar do Word ou do Google Docs mantém o negrito, as listas e os títulos.</p>
          <Imagem rotulo="Ícone ou imagem do cartão (opcional)" valor={d.imagem} onMudar={imagem => mudar({ imagem })} />
        </Grupo>

        <Grupo titulo="Página do serviço">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="Botão no topo da página do serviço" ajuda="Ex.: «Pedir proposta». Vazio = sem botão.">{p => <Entrada {...p} maxLength={L.rotulo} value={d.rotulo} onChange={x => mudar({ rotulo: x.target.value })} />}</Campo>
            <Campo rotulo="Ligação do botão" ajuda="#contactos (rodapé), uma página, mailto: ou tel:">{p => <Entrada {...p} maxLength={L.ligacao} value={d.ligacao} onChange={x => mudar({ ligacao: x.target.value })} />}</Campo>
          </div>
          <Campo rotulo="Endereço da página" ajuda={`Vazio = feito do título. Mudar o endereço muda a ligação: quem tiver a antiga fica sem página. Agora: /empresas/${slug || "…"}`}>
            {p => <Entrada {...p} maxLength={L.slug} value={e.slug} placeholder={slugServico({ titulo: d.titulo })} onChange={x => setE({ ...e, slug: x.target.value })} />}
          </Campo>
          <Imagem rotulo="Imagem do topo da página (à direita)" valor={d.capa ?? ""} onMudar={capa => mudar({ capa })} />
          <Campo rotulo="Título do texto" ajuda="Vazio = «Sobre o serviço» (ou o que estiver no modelo da página).">{p => <Entrada {...p} maxLength={L.tituloDetalhe} value={d.tituloDetalhe ?? ""} onChange={x => mudar({ tituloDetalhe: x.target.value })} />}</Campo>
          <CampoTexto rotulo="Texto completo" ajuda={`Vazio = a descrição curta. ${AJUDA_FORMATACAO}`} linhas={10} max={L.detalhe} valor={d.detalhe ?? ""} onMudar={detalhe => mudar({ detalhe })} previa />
          <Lista titulo="Cartões (ex.: vantagens, passos ou ligações a outros serviços)" itens={d.cartoes ?? []} novo={{ titulo: "", texto: "", rotulo: "", ligacao: "" }} onMudar={cartoes => mudar({ cartoes })} max={12}
            render={(it, set) => (
              <>
                <Campo rotulo="Título do cartão">{p => <Entrada {...p} maxLength={L.cartaoTitulo} value={it.titulo} onChange={x => set({ ...it, titulo: x.target.value })} />}</Campo>
                <CampoTexto rotulo="Texto do cartão" linhas={4} max={L.cartaoTexto} valor={it.texto ?? ""} onMudar={texto => set({ ...it, texto })} previa />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo rotulo="Ligação (opcional)" ajuda="Ex.: /empresas/certificacao-inicial. Vazio = cartão sem ligação.">{p => <Entrada {...p} maxLength={L.ligacao} value={it.ligacao ?? ""} onChange={x => set({ ...it, ligacao: x.target.value.trim() })} />}</Campo>
                  <Campo rotulo="Texto do botão" ajuda="Vazio = «Saber mais».">{p => <Entrada {...p} maxLength={L.cartaoRotulo} value={it.rotulo ?? ""} onChange={x => set({ ...it, rotulo: x.target.value })} />}</Campo>
                </div>
              </>
            )} />
          <Campo rotulo="Vídeo (opcional)" erro={videoMau ? "Use um endereço do YouTube, do Vimeo ou de um ficheiro .mp4 (https)." : null} ajuda="Endereço do YouTube, do Vimeo ou de um ficheiro .mp4. Vazio = sem vídeo.">
            {p => <Entrada {...p} type="url" maxLength={L.video} value={d.video} placeholder="https://www.youtube.com/watch?v=…" onChange={x => mudar({ video: x.target.value.trim() })} />}
          </Campo>
          <Lista titulo="Imagens (carrossel)" itens={d.imagens ?? []} novo={{ imagem: "", legenda: "" }} onMudar={imagens => mudar({ imagens })} max={30}
            render={(it, set) => (
              <>
                <Imagem rotulo="Imagem" valor={it.imagem} onMudar={imagem => set({ ...it, imagem })} />
                <Campo rotulo="Legenda (opcional)">{p => <Entrada {...p} maxLength={L.legenda} value={it.legenda} onChange={x => set({ ...it, legenda: x.target.value })} />}</Campo>
              </>
            )} />
          <Lista titulo="Logótipos (clientes, parceiros, certificações)" itens={d.logos ?? []} novo={{ imagem: "", alt: "", ligacao: "" }} onMudar={logos => mudar({ logos })} max={60}
            render={(it, set) => (
              <>
                <Imagem rotulo="Logótipo" valor={it.imagem} onMudar={imagem => set({ ...it, imagem })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo rotulo="Nome">{p => <Entrada {...p} maxLength={L.logoNome} value={it.alt} onChange={x => set({ ...it, alt: x.target.value })} />}</Campo>
                  <Campo rotulo="Ligação (opcional)">{p => <Entrada {...p} maxLength={L.ligacao} value={it.ligacao} onChange={x => set({ ...it, ligacao: x.target.value })} />}</Campo>
                </div>
              </>
            )} />
          <Campo rotulo="Faixa final: título" ajuda="Vazio = o do modelo («Fale connosco sobre a sua equipa.»).">{p => <Entrada {...p} maxLength={L.ctaTitulo} value={d.ctaTitulo ?? ""} onChange={x => mudar({ ctaTitulo: x.target.value })} />}</Campo>
          <CampoTexto rotulo="Faixa final: texto" ajuda="Vazio = o do modelo." linhas={3} max={L.ctaTexto} valor={d.ctaTexto ?? ""} onMudar={ctaTexto => mudar({ ctaTexto })} previa />
        </Grupo>
      </div>
    </PainelLateral>
  );
}

/**
 * Texto longo: contador «n / máx.» e aviso no limite (nada se corta sem se dizer), colagem do Word / Google Docs
 * passada à formatação leve e, com `previa`, o texto como o site o mostra (o mesmo componente do site).
 */
function CampoTexto({ rotulo, ajuda, valor, max, linhas, onMudar, previa }: {
  rotulo: string; ajuda?: string; valor: string; max: number; linhas: number; onMudar: (v: string) => void; previa?: boolean;
}) {
  const [cortado, setCortado] = useState(0); // caracteres que ficaram de fora na última colagem ou escrita
  const mudar = (v: string) => {
    setCortado(Math.max(0, v.length - max));
    onMudar(v.length > max ? v.slice(0, max) : v);
  };
  function colar(ev: ClipboardEvent<HTMLTextAreaElement>) {
    const cd = ev.clipboardData;
    let texto = "";
    const html = cd.getData("text/html");
    if (html && typeof DOMParser !== "undefined") {
      try { texto = htmlParaTexto(new DOMParser().parseFromString(html, "text/html").body); } catch { texto = ""; }
    }
    texto = normalizarColagem(texto.trim() ? texto : cd.getData("text/plain"));
    if (!texto) return;
    ev.preventDefault();
    const el = ev.currentTarget;
    const [a, b] = [el.selectionStart, el.selectionEnd];
    const entra = texto.slice(0, Math.max(0, max - (valor.length - (b - a))));
    // insertText: a colagem entra no histórico do campo (Ctrl+Z desfaz). Se o navegador não o fizer, muda-se o valor à mão.
    let feito = false;
    try { feito = entra !== "" && document.execCommand("insertText", false, entra); } catch { feito = false; }
    if (!feito && entra) {
      onMudar(valor.slice(0, a) + entra + valor.slice(b));
      requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = a + entra.length; });
    }
    setCortado(texto.length - entra.length);
  }
  const n = valor.length;
  const noLimite = n >= max;
  return (
    <Campo rotulo={rotulo} ajuda={ajuda}>
      {p => (
        <>
          <AreaTexto {...p} rows={linhas} value={valor} onChange={x => mudar(x.target.value)} onPaste={colar} />
          <div className="flex flex-wrap items-start justify-between gap-x-3 text-xs" aria-live="polite">
            <span className={cortado > 0 || noLimite ? "font-semibold text-perigo" : "text-tinta-suave"}>
              {cortado > 0 ? `Não coube tudo: ficaram de fora ${cortado} caracteres (o limite é ${max}). Encurte o texto ou divida-o.`
                : noLimite ? `Chegou ao limite de ${max} caracteres: o que escrever a mais não fica.` : ""}
            </span>
            <span className={noLimite ? "tabular-nums text-perigo" : "tabular-nums text-tinta-suave"}>{n} / {max}</span>
          </div>
          {previa && valor.trim() && (
            <details open className="rounded-md border border-linha bg-black/[0.02] px-3 py-2">
              <summary className="cursor-pointer text-xs font-semibold text-tinta-suave">Pré-visualização (como fica no site)</summary>
              <TextoFormatado texto={valor} className="mt-2 text-sm leading-6 text-tinta" nivel={4} />
            </details>
          )}
        </>
      )}
    </Campo>
  );
}

/** O cartão deste serviço tem texto próprio na página Empresas (editor do site): o site mostra esse, não o daqui. */
function AvisoTextosProprios({ publicado, rascunho }: { publicado: TextosProprios | null; rascunho: TextosProprios | null }) {
  const nomes: Record<keyof TextosProprios, string> = { titulo: "título", texto: "descrição", pontos: "pontos" };
  const lista = (t: TextosProprios) => (Object.keys(t) as (keyof TextosProprios)[]).map(k => nomes[k]).join(", ");
  return (
    <Aviso tom="aviso" titulo="Este cartão tem texto próprio na página Empresas (editor do site)">
      {publicado
        ? <>No cartão da página Empresas, o site mostra o que lá está escrito ({lista(publicado)}), não o daqui. </>
        : <>O rascunho da página Empresas tem texto próprio para este cartão ({lista(rascunho!)}): quando for publicado, passa à frente do daqui. </>}
      {publicado && rascunho && lista(rascunho) !== lista(publicado) && <>No rascunho: {lista(rascunho)}. </>}
      Para o cartão usar o texto daqui, apague-o em Sistema › Site › página «Empresas» › bloco «Serviços» › «Textos só desta página» e publique.
      A página do serviço usa sempre o texto daqui.
    </Aviso>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 flex flex-col gap-3 rounded-lg border border-linha p-4">
      <legend className="px-1 text-sm font-semibold">{titulo}</legend>
      {children}
    </fieldset>
  );
}

/** Lista editável (imagens, logótipos): acrescentar, tirar e mudar a ordem. */
function Lista<T>({ titulo, itens, novo, onMudar, render, max }: {
  titulo: string; itens: T[]; novo: T; onMudar: (l: T[]) => void; render: (it: T, set: (v: T) => void) => ReactNode; max: number;
}) {
  const trocar = (i: number, j: number) => { const l = [...itens]; [l[i], l[j]] = [l[j]!, l[i]!]; onMudar(l); };
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-sm font-semibold">{titulo}</p>
      {itens.map((it, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-md border border-linha bg-black/[0.02] p-3">
          {render(it, v => onMudar(itens.map((x, k) => (k === i ? v : x))))}
          <div className="flex justify-end gap-1 text-sm">
            <Botao variante="fantasma" disabled={i === 0} onClick={() => trocar(i, i - 1)}>Subir</Botao>
            <Botao variante="fantasma" disabled={i === itens.length - 1} onClick={() => trocar(i, i + 1)}>Descer</Botao>
            <Botao variante="fantasma" onClick={() => onMudar(itens.filter((_, k) => k !== i))}>Tirar</Botao>
          </div>
        </div>
      ))}
      {itens.length < max && <Botao onClick={() => onMudar([...itens, { ...novo }])}>Acrescentar</Botao>}
    </div>
  );
}

/** Carregar uma imagem para o site (fica na biblioteca de imagens do site) ou tirá-la. */
function Imagem({ rotulo, valor, onMudar }: { rotulo: string; valor: string; onMudar: (url: string) => void }) {
  const [aCarregar, setACarregar] = useState(false);
  const [erro, setErro] = useState("");
  async function carregar(f: File | undefined) {
    if (!f) return;
    setACarregar(true);
    setErro("");
    try { onMudar((await apiImagemSite(f)).url); } catch (x) { setErro(x instanceof Error ? x.message : "Não foi possível carregar a imagem."); } finally { setACarregar(false); }
  }
  return (
    <Campo rotulo={rotulo} erro={erro || null} ajuda="JPG, PNG, WebP ou SVG, até 8 MB.">
      {p => (
        <div className="flex flex-wrap items-center gap-3">
          {valor && <img src={valor} alt="" className="h-14 w-20 rounded border border-linha object-contain" />}
          <input {...p} type="file" accept="image/*" disabled={aCarregar} onChange={x => void carregar(x.target.files?.[0])} className="text-sm" />
          {aCarregar && <span className="text-sm text-tinta-suave">A carregar…</span>}
          {valor && <Botao variante="fantasma" onClick={() => onMudar("")}>Tirar</Botao>}
        </div>
      )}
    </Campo>
  );
}
