// Sistema › Site: editor visual das páginas (blocos, como num construtor de sites) e definições gerais.
import { lazy, Suspense, useEffect, useState } from "react";
import { usePode } from "../../../partilhado/AuthGate";
import { apiDefinicoes, apiGravarDefinicao } from "../../../partilhado/api/site";
import { useAccao } from "../../../partilhado/dados/useAccao";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import { PAGINAS_SITE, type PaginaSite } from "../../../partilhado/siteBlocos";
import { SITE_OMISSAO } from "../../../partilhado/siteConteudo";
import { AreaTexto, Aviso, Botao, Campo, Cartao, Entrada, ErroCarregar, Esqueleto, Interruptor, cx } from "../../../partilhado/ui";
import type { VistaProps } from "../../shell/tipos";
import { TestemunhosSite } from "./TestemunhosSite";

const EditorPagina = lazy(() => import("./EditorPagina").then(m => ({ default: m.EditorPagina })));

type Separador = "paginas" | "testemunhos" | "definicoes";

export default function Site(_props: VistaProps) {
  const podeEditar = usePode()("site.editar");
  const [sep, setSep] = useState<Separador>("paginas");
  // A página em edição fica no endereço (?pagina=catalogo), para voltar a ela ao recarregar.
  const [pagina, setPagina] = useState<PaginaSite>(() => {
    const p = new URLSearchParams(window.location.search).get("pagina");
    return (PAGINAS_SITE as readonly string[]).includes(p ?? "") ? p as PaginaSite : "inicio";
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
        {([["paginas", "Páginas do site"], ["testemunhos", "Testemunhos"], ["definicoes", "Definições"]] as const).map(([id, rotulo]) => (
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
          : <div className="h-full overflow-auto px-4 py-5 sm:px-8 sm:py-6">{sep === "testemunhos" ? <TestemunhosSite /> : <DefinicoesSite />}</div>}
      </div>
    </div>
  );
}

const CHAVES = ["tituloSeparador", "rgpdObrigatorio", "rgpdVersao", "evaNome", "evaBoasVindas", "evaObjetivos"] as const;
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
        </div>
      </Cartao>
      <div><Botao variante="primario" aCarregar={gravar.aCorrer} onClick={() => void gravar.correr(v)}>Gravar definições</Botao></div>
    </div>
  );
}
