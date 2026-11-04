// Sistema › Site: editor visual das páginas (blocos, como num construtor de sites) e definições gerais.
import { lazy, Suspense, useEffect, useState } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import { apiDefinicoes, apiGravarDefinicao } from "../../../partilhado/api/site";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { paginaValida, type PaginaSite } from "../../../partilhado/siteBlocos";
import { SITE_OMISSAO } from "../../../partilhado/siteConteudo";
import { AreaTexto, Aviso, Botao, Campo, Cartao, Entrada, ErroCarregar, Esqueleto, Interruptor, cx } from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { TestemunhosSite } from "./TestemunhosSite";
import { SeoSite } from "./SeoSite";

const EditorPagina = lazy(() => import("./EditorPagina").then(m => ({ default: m.EditorPagina })));

type Separador = "paginas" | "testemunhos" | "seo" | "definicoes";

export default function Site(_props: VistaProps) {
  const podeEditar = usePode()("site.editar");
  const [sep, setSep] = useState<Separador>("paginas");
  // A página em edição fica no endereço (?pagina=catalogo), para voltar a ela ao recarregar.
  const [pagina, setPagina] = useState<PaginaSite>(() => {
    const p = new URLSearchParams(window.location.search).get("pagina");
    return p && paginaValida(p) ? p : "inicio";
  });
  const mudarPagina = (p: PaginaSite) => {
    setPagina(p);
    const url = new URL(window.location.href);
    if (p === "inicio") url.searchParams.delete("pagina"); else url.searchParams.set("pagina", p);
    window.history.replaceState(null, "", url);
  };
  if (!podeEditar) return <Aviso tom="aviso">Só o administrador edita o site.</Aviso>;
  return (
    // O editor ocupa a área toda (sem as margens do ecrã) para a pré-visualização ser o mais larga possível.
    <div className="-mx-4 -my-5 flex h-[calc(100%+2.5rem)] flex-col sm:-mx-8 sm:-my-6 sm:h-[calc(100%+3rem)]">
      <div role="tablist" aria-label="Site" className="flex shrink-0 items-center gap-1 border-b border-linha bg-superficie px-3">
        {([["paginas", "Páginas do site"], ["testemunhos", "Testemunhos"], ["seo", "SEO"], ["definicoes", "Definições"]] as const).map(([id, rotulo]) => (
          <button key={id} type="button" role="tab" aria-selected={sep === id} onClick={() => setSep(id)}
            className={cx("border-b-2 px-3 py-2.5 text-sm font-semibold", sep === id ? "border-acao text-tinta" : "border-transparent text-tinta-suave hover:text-tinta")}>
            {rotulo}
          </button>
        ))}
        <span className="ml-auto hidden text-xs text-tinta-suave md:inline">Escolha a página no ícone «Páginas», à esquerda, por baixo de Blocos e Estrutura.</span>
      </div>
      <div className="min-h-0 flex-1">
        {sep === "paginas"
          ? <Suspense fallback={<Esqueleto linhas={10} className="m-6" />}><EditorPagina key={pagina} pagina={pagina} onMudarPagina={mudarPagina} /></Suspense>
          : <div className="h-full overflow-auto px-4 py-5 sm:px-8 sm:py-6">{sep === "testemunhos" ? <TestemunhosSite /> : sep === "seo" ? <SeoSite /> : <DefinicoesSite />}</div>}
      </div>
    </div>
  );
}

const CHAVES_INSCRICAO = [
  ["inscEtiqueta", "Etiqueta por cima do nome do curso"], ["inscTituloDatas", "Título da escolha da turma"],
  ["inscAjudaDatas", "Ajuda por baixo do título"], ["inscSemDatas", "Sem turmas no local ({local} = o local)"],
  ["inscVerCronograma", "Botão do cronograma"], ["inscCheia", "Turma cheia"], ["inscRecebido", "Etiqueta do pedido recebido"],
  ["inscRecebidoTexto", "Texto do pedido recebido ({curso} = o curso, {email} = o email da pessoa)"],
  ["inscRecebidoTextoCcp", "Texto do pedido recebido no CCP ({email} = o email da pessoa)"],
] as const;
const CHAVES_LIGACAO = [
  ["ligPagamentoTexto", "Texto do passo de pagamento ({curso} = o curso)"], ["ligComprovativoAjuda", "Ajuda do comprovativo"],
  ["ligBotaoComprovativo", "Botão de anexar o comprovativo"],
] as const;
const CORES = [
  ["inscCorPrincipal", "Pré-inscrição · cor principal"], ["inscCorDestaque", "Pré-inscrição · cor de destaque"],
  ["ligCorDestaque", "Ligação pessoal · cor de destaque"], ["ligCorFundo", "Ligação pessoal · fundo"],
] as const;
const CHAVES = ["tituloSeparador", "rgpdObrigatorio", "rgpdVersao", "evaNome", "evaBoasVindas", "evaObjetivos", "evaWhatsapp",
  ...CHAVES_INSCRICAO.map(([k]) => k), ...CHAVES_LIGACAO.map(([k]) => k), ...CORES.map(([k]) => k)] as const;
type Chave = typeof CHAVES[number];

/** Definições do site que não são layout: separador do browser, consentimento e assistente. */
function DefinicoesSite() {
  const { dados, erro, recarregar } = useRecurso("definicoes", s => apiDefinicoes(s));
  const [v, setV] = useState<Record<Chave, string> | null>(null);
  useEffect(() => {
    if (!dados || v) return;
    const site = dados.settings.site ?? {};
    const omissao = SITE_OMISSAO as Record<string, string>;
    setV(Object.fromEntries(CHAVES.map(k => [k, site[k] ?? omissao[k] ?? ""])) as Record<Chave, string>);
  }, [dados, v]);
  // O PUT substitui o objecto todo: junta-se ao que já está gravado.
  const gravar = useAccao((valores: Record<Chave, string>) => apiGravarDefinicao("site", { ...(dados?.settings.site ?? {}), ...valores }), {
    ok: "Definições do site gravadas.", invalidar: ["definicoes"],
  });
  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!v) return <Esqueleto linhas={6} className="max-w-2xl" />;
  const mudar = (k: Chave, x: string) => setV({ ...v, [k]: x });
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <Cartao titulo="Separador do browser">
        <Campo rotulo="Título">{p => <Entrada {...p} value={v.tituloSeparador} onChange={e => mudar("tituloSeparador", e.target.value.slice(0, 120))} />}</Campo>
      </Cartao>
      <Cartao titulo="Formulário de pré-inscrição" subtitulo="Regras do formulário público de pré-inscrição.">
        <div className="flex flex-col gap-3">
          <Interruptor rotulo="Consentimento obrigatório" ligado={["1", "true", "sim"].includes(v.rgpdObrigatorio.toLowerCase())}
            onMudar={x => mudar("rgpdObrigatorio", x ? "1" : "0")} />
          <Campo rotulo="Versão da política de privacidade">
            {p => <Entrada {...p} className="max-w-[12rem]" value={v.rgpdVersao} placeholder="1" onChange={e => mudar("rgpdVersao", e.target.value.slice(0, 40))} />}
          </Campo>
        </div>
      </Cartao>
      <Cartao titulo="Assistente do site" subtitulo="A conversa que ajuda a escolher a formação (botão no canto do site).">
        <div className="flex flex-col gap-3">
          <Campo rotulo="Nome da assistente">{p => <Entrada {...p} value={v.evaNome} onChange={e => mudar("evaNome", e.target.value.slice(0, 60))} />}</Campo>
          <Campo rotulo="Frase de boas-vindas">{p => <AreaTexto {...p} rows={3} value={v.evaBoasVindas} onChange={e => mudar("evaBoasVindas", e.target.value.slice(0, 800))} />}</Campo>
          <Campo rotulo="Objectivos, um por linha" ajuda="Depois de | vêm as áreas do curso, separadas por vírgula.">
            {p => <AreaTexto {...p} rows={5} value={v.evaObjetivos} onChange={e => mudar("evaObjetivos", e.target.value.slice(0, 800))} />}
          </Campo>
          <Campo rotulo="WhatsApp da ENA para «Falar com um operador»" ajuda="Com o indicativo, só números (ex.: 351912345678). A pessoa abre a conversa no WhatsApp dela com este número e a ENA responde-lhe diretamente. Vazio: só fica o formulário de contacto.">
            {p => <Entrada {...p} className="max-w-[16rem]" inputMode="numeric" placeholder="351…" value={v.evaWhatsapp} onChange={e => mudar("evaWhatsapp", e.target.value.replace(/\D/g, "").slice(0, 15))} />}
          </Campo>
        </div>
      </Cartao>
      <Cartao titulo="Janela de pré-inscrição" subtitulo="Os textos da janela que abre ao clicar em «Pré-inscrição» num curso.">
        <div className="flex flex-col gap-3">
          {CHAVES_INSCRICAO.map(([k, rotulo]) => (
            <Campo key={k} rotulo={rotulo}>{p => <AreaTexto {...p} rows={2} value={v[k]} onChange={e => mudar(k, e.target.value.slice(0, 800))} />}</Campo>
          ))}
        </div>
      </Cartao>
      <Cartao titulo="Ligação pessoal" subtitulo="As páginas dos documentos e do pagamento que a pessoa abre pelo email.">
        <div className="flex flex-col gap-3">
          {CHAVES_LIGACAO.map(([k, rotulo]) => (
            <Campo key={k} rotulo={rotulo}>{p => <AreaTexto {...p} rows={2} value={v[k]} onChange={e => mudar(k, e.target.value.slice(0, 800))} />}</Campo>
          ))}
        </div>
      </Cartao>
      <Cartao titulo="Cores" subtitulo="Da janela de pré-inscrição e das páginas da ligação pessoal.">
        <div className="grid gap-3 sm:grid-cols-2">
          {CORES.map(([k, rotulo]) => (
            <Campo key={k} rotulo={rotulo}>
              {p => (
                <div className="flex items-center gap-2">
                  <input type="color" aria-label={rotulo} value={/^#[0-9a-f]{6}$/i.test(v[k]) ? v[k] : "#000000"} onChange={e => mudar(k, e.target.value)} className="h-9 w-12 cursor-pointer rounded border border-linha" />
                  <Entrada {...p} className="max-w-[9rem] font-mono" value={v[k]} onChange={e => mudar(k, e.target.value.trim().slice(0, 9))} />
                </div>
              )}
            </Campo>
          ))}
        </div>
      </Cartao>
      <div><Botao variante="primario" aCarregar={gravar.aCorrer} onClick={() => void gravar.correr(v)}>Gravar definições</Botao></div>
    </div>
  );
}
