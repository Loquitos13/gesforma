// Sistema › Site: conteúdo do site público, por secção, com pré-visualização do rascunho.
import { useEffect, useMemo, useState } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import { apiDefinicoes, apiGravarDefinicao, apiImagemHero } from "../../../partilhado/api/site";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useOpcoes } from "../../../partilhado/dados/useOpcoes";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { SITE_GRUPOS, SITE_OMISSAO, type HeroSlot, type SiteChave } from "../../../partilhado/siteConteudo";
import { toastError } from "../../../partilhado/toastBus";
import {
  AreaTexto, Aviso, Botao, Campo, Cartao, ConfirmarPerigo, Entrada, ErroCarregar, Esqueleto, Interruptor, PageHeader, cx,
} from "../../../partilhado/ui";
import { CartoesHero } from "../../SiteCartoesHero";
import { CarregarFotografia, ComposicaoHero, ControlosMargem, HERO, type CursoPublico } from "../../SiteConteudoView";
import { SiteSeccaoPreview, type OfertaPreview } from "../../SitePreview";
import type { VistaProps } from "../../shell/tipos";

const FORMULARIO = "Formulário de pré-inscrição";
type Rascunho = Record<string, string>;

/** Chaves que cada secção grava (para saber o que tem alterações por publicar). */
function chavesDe(titulo: string): string[] {
  if (titulo === FORMULARIO) return ["rgpdObrigatorio", "rgpdVersao"];
  const g = SITE_GRUPOS.find(x => x.titulo === titulo);
  const base = g?.campos.map(c => c.chave as string) ?? [];
  const prefixo = { Cabeçalho: "cabecalho", Destaque: "hero", "Oferta formativa": "oferta", Apresentação: "metodo", Empresas: "empresas", Rodapé: "rodape" }[titulo];
  const extra = prefixo ? Object.keys(SITE_OMISSAO).filter(k => k.toLowerCase().startsWith(prefixo.toLowerCase())) : [];
  return [...new Set([...base, ...extra])];
}

export default function Site({ navigate }: VistaProps) {
  const podeEditar = usePode()("site.editar");
  const { dados, erro, recarregar } = useRecurso("definicoes", signal => apiDefinicoes(signal));
  const origens = useOpcoes("lista", { lista: "origens" });
  const gravado = useMemo<Rascunho>(() => ({ ...SITE_OMISSAO, ...(dados?.settings.site ?? {}) }), [dados]);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [seccao, setSeccao] = useState<string>(SITE_GRUPOS[0]!.titulo);
  const [descartar, setDescartar] = useState(false);
  const [oferta, setOferta] = useState<OfertaPreview | null>(null);
  const [cursosEstado, setCursosEstado] = useState<"a-carregar" | "pronto" | "erro">("a-carregar");
  const [aEnviar, setAEnviar] = useState<HeroSlot | null>(null);
  const [erroImagem, setErroImagem] = useState<Record<HeroSlot, string>>({ 1: "", 2: "" });
  const [aEnviarFundo, setAEnviarFundo] = useState<"fundo" | "apresentacao" | null>(null);
  const [erroFundo, setErroFundo] = useState({ fundo: "", apresentacao: "" });
  const ano = new Date().getFullYear();

  useEffect(() => { if (dados && !rascunho) setRascunho(gravado); }, [dados, gravado, rascunho]);
  useEffect(() => {
    let vivo = true;
    fetch("/api/v1/public/catalogo", { cache: "no-store" })
      .then(async r => { if (!r.ok) throw new Error(); return r.json() as Promise<{ cursos?: CursoPublico[]; destaques?: CursoPublico[]; ccp?: CursoPublico | null }>; })
      .then(d => { if (vivo) { setOferta({ cursos: d.cursos ?? [], destaques: d.destaques ?? [], ccp: d.ccp ?? null }); setCursosEstado("pronto"); } })
      .catch(() => { if (vivo) setCursosEstado("erro"); });
    return () => { vivo = false; };
  }, []);

  const publicar = useAccao(
    (valores: Rascunho) => apiGravarDefinicao("site", valores),
    { ok: "Site publicado.", invalidar: ["definicoes"] },
  );

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!rascunho) return <Esqueleto linhas={10} />;

  const draft = rascunho as Record<SiteChave, string>;
  const escrever = (chave: string, valor: string) => setRascunho(r => ({ ...(r ?? {}), [chave]: valor }));
  const porPublicar = (titulo: string) => chavesDe(titulo).some(k => (rascunho[k] ?? "") !== (gravado[k] ?? ""));
  const algumaAlteracao = Object.keys({ ...rascunho, ...gravado }).some(k => (rascunho[k] ?? "") !== (gravado[k] ?? ""));
  const grupo = SITE_GRUPOS.find(g => g.titulo === seccao);

  async function carregarFundo(slot: "fundo" | "apresentacao", chave: string, file: File) {
    setAEnviarFundo(slot);
    setErroFundo(a => ({ ...a, [slot]: "" }));
    try { escrever(chave, (await apiImagemHero(slot, file)).url); } catch (e) { setErroFundo(a => ({ ...a, [slot]: e instanceof Error ? e.message : "Não foi possível gravar a imagem." })); } finally { setAEnviarFundo(null); }
  }
  async function carregarMiniatura(slot: HeroSlot, file: File) {
    setAEnviar(slot);
    setErroImagem(a => ({ ...a, [slot]: "" }));
    try { escrever(HERO[slot].imagem, (await apiImagemHero(String(slot) as "1" | "2", file)).url); } catch (e) { setErroImagem(a => ({ ...a, [slot]: e instanceof Error ? e.message : "Não foi possível gravar a imagem." })); toastError(e, "Imagem recusada."); } finally { setAEnviar(null); }
  }

  const seccoes = [...SITE_GRUPOS.map(g => g.titulo), FORMULARIO];

  return (
    <div className="space-y-5">
      <PageHeader
        trilho={[{ rotulo: "Sistema" }, { rotulo: "Site" }]}
        titulo="Site"
        subtitulo="Edite por secção e veja o rascunho ao lado. O site público só muda quando publicar."
        acoes={(
          <>
            <a href="/" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-controlo border border-linha-forte bg-superficie px-4 text-sm hover:bg-fundo">Abrir o site</a>
            {podeEditar && <Botao variante="secundario" disabled={!algumaAlteracao} onClick={() => setDescartar(true)}>Descartar</Botao>}
            {podeEditar && (
              <Botao variante="primario" aCarregar={publicar.aCorrer} disabled={!algumaAlteracao || aEnviar != null || aEnviarFundo != null}
                onClick={() => void publicar.correr(Object.fromEntries(Object.entries(rascunho).map(([k, v]) => [k, String(v ?? "")])))}>
                Publicar
              </Botao>
            )}
          </>
        )}
      />
      {!podeEditar && <Aviso tom="info">Só o administrador edita o site. Pode consultar o conteúdo.</Aviso>}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[220px_minmax(0,1fr)_minmax(300px,400px)]">
        <Cartao semPadding as="div">
          <nav aria-label="Secções do site" className="p-2">
            <ul className="m-0 list-none space-y-0.5 p-0">
              {seccoes.map(t => (
                <li key={t}>
                  <button type="button" aria-current={t === seccao ? "true" : undefined} onClick={() => setSeccao(t)}
                    className={cx("flex w-full items-center justify-between gap-2 rounded-controlo px-3 py-2 text-left text-sm", t === seccao ? "bg-tinta text-white" : "hover:bg-fundo")}>
                    {t}
                    {porPublicar(t) && <span className="h-2 w-2 rounded-full bg-acao" title="Alterações por publicar" />}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </Cartao>

        <fieldset disabled={!podeEditar} className="m-0 min-w-0 border-0 p-0">
          {grupo ? (
            <Cartao titulo={grupo.titulo} subtitulo={grupo.titulo === "Rodapé" ? `${grupo.nota ?? ""} Este ano aparece © ${ano}.` : grupo.nota}>
              <div className="space-y-4">
                <ControlosMargem titulo={grupo.titulo} draft={draft} onChange={escrever} />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {grupo.campos.map(c => (
                    <Campo key={c.chave} rotulo={c.etiqueta} className={c.tipo === "texto" ? "md:col-span-2" : undefined}>
                      {p => (
                        <>
                          {c.tipo === "texto"
                            ? <AreaTexto {...p} value={draft[c.chave] ?? ""} onChange={e => escrever(c.chave, e.target.value)} />
                            : <Entrada {...p} type={c.tipo === "url" ? "url" : "text"} value={draft[c.chave] ?? ""} onChange={e => escrever(c.chave, e.target.value)} />}
                          {(c.chave === "heroImagem" || c.chave === "metodoImagem") && (
                            <CarregarFotografia
                              slot={c.chave === "heroImagem" ? "fundo" : "apresentacao"}
                              aEnviar={aEnviarFundo}
                              erro={erroFundo[c.chave === "heroImagem" ? "fundo" : "apresentacao"]}
                              onFile={file => void carregarFundo(c.chave === "heroImagem" ? "fundo" : "apresentacao", c.chave, file)}
                            />
                          )}
                        </>
                      )}
                    </Campo>
                  ))}
                </div>
                {grupo.titulo === "Destaque" && <ComposicaoHero draft={draft} onChange={escrever} />}
                {grupo.titulo === "Destaque" && (
                  <CartoesHero draft={draft} cursos={oferta?.cursos ?? []} cursosEstado={cursosEstado} aEnviar={aEnviar} erroImagem={erroImagem}
                    onChange={escrever} onFile={(slot, file) => void carregarMiniatura(slot, file)} />
                )}
              </div>
            </Cartao>
          ) : (
            <Cartao titulo={FORMULARIO} subtitulo="Regras do formulário público de pré-inscrição.">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4 rounded-controlo border border-linha p-4">
                  <div>
                    <p className="m-0 text-sm font-semibold">Aceitação da política de privacidade obrigatória</p>
                    <p className="m-0 mt-0.5 text-xs text-tinta-suave">Cada pré-inscrição guarda a data, o IP e a versão aceite.</p>
                  </div>
                  <Interruptor rotulo="Consentimento obrigatório" ligado={["1", "true", "sim"].includes((rascunho.rgpdObrigatorio ?? "").toLowerCase())}
                    onMudar={v => escrever("rgpdObrigatorio", v ? "1" : "0")} />
                </div>
                <Campo rotulo="Versão do texto de privacidade" ajuda="Mude a versão sempre que a política mudar. As pré-inscrições antigas mantêm a versão que aceitaram.">
                  {p => <Entrada {...p} className="max-w-[12rem]" value={rascunho.rgpdVersao ?? ""} placeholder="1" onChange={e => escrever("rgpdVersao", e.target.value.slice(0, 40))} />}
                </Campo>
                <div>
                  <p className="m-0 mb-1 text-[13px] font-medium">Opções de «Como conheceu a ENA?»</p>
                  <p className="m-0 text-sm text-tinta-suave">{origens.opcoes.map(o => o.rotulo).join(" · ") || "Sem opções."}</p>
                  <Botao className="mt-2" tamanho="sm" variante="ligacao" onClick={() => navigate("listas-opcoes")}>Editar em Listas de opções</Botao>
                </div>
              </div>
            </Cartao>
          )}
        </fieldset>

        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          {grupo ? <SiteSeccaoPreview titulo={grupo.titulo} draft={draft} oferta={oferta} ano={ano} /> : (
            <Cartao titulo="Pré-visualização">
              <p className="m-0 text-sm text-tinta-suave">O formulário mostra as opções de origem acima e, se activado, a caixa de aceitação da política de privacidade.</p>
            </Cartao>
          )}
        </div>
      </div>
      <ConfirmarPerigo
        aberto={descartar}
        onFechar={() => setDescartar(false)}
        titulo="Descartar alterações"
        descricao="O rascunho volta ao que está publicado. As alterações por publicar perdem-se."
        acao="Descartar"
        onConfirmar={() => { setRascunho(gravado); setDescartar(false); }}
      />
    </div>
  );
}
