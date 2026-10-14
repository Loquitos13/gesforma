import { Component, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../../partilhado/AuthGate";
import { armViewLoading } from "../../partilhado/viewLoadingBus";
import { Botao, Esqueleto } from "../../partilhado/ui";
import { DocAlertas } from "../DocAlertas";
import { tabDoFormador } from "../vistas/turmas/cockpit/base";
import { caminhoDaVista, vistaDoCaminho, type Destino, type Vista } from "../rotasGesforma";
import { FileDialogPaint, ViewLoadingOverlay } from "../ViewLoading";
import { Cabecalho } from "./Cabecalho";
import { painelDoPerfil, vistaNoMenuDoPerfil, VISTAS_FORMADOR } from "./navegacao";
import { Pesquisa } from "./Pesquisa";
import { ROTAS } from "./rotas";
import { Sidebar } from "./Sidebar";
import type { ParamsVista, VistaProps } from "./tipos";

function paramsDe(d: Partial<Destino>, drive?: string): ParamsVista {
  return {
    tab: d.tab ?? "overview",
    turmaId: d.turmaId,
    cursoId: d.cursoId ?? ((d.view === "gold-curso-ficha" || d.view === "fin-curso-ficha") ? "new" : undefined),
    cursoNome: d.cursoNome,
    formandoId: d.formandoId,
    formandoOrigem: d.formandoOrigem,
    formadorId: d.formadorId,
    leadId: d.leadId,
    drive,
  };
}

/** Aplica as regras de acesso do perfil a um destino (o servidor volta a verificar tudo). */
function destinoPermitido(d: Destino, role: string): Destino {
  if (d.view === "site" && role !== "admin") return { view: painelDoPerfil(role) };
  if (role === "formador" && !VISTAS_FORMADOR.has(d.view)) return { view: "formador-turmas" };
  if (role === "formador" && (d.view === "gold-cockpit-turma" || d.view === "fin-cockpit-turma")) return { ...d, tab: tabDoFormador(d.tab) };
  if (role !== "formador" && !vistaNoMenuDoPerfil(role, d.view)) return { view: painelDoPerfil(role) };
  return d;
}

function arranque(role: string): { view: Vista; params: ParamsVista } {
  const drive = new URLSearchParams(window.location.search).get("drive") ?? "";
  if (drive && window.location.pathname.startsWith("/gesforma")) return { view: "configuracoes", params: paramsDe({}, drive) };
  const lido = vistaDoCaminho(window.location.pathname, window.location.search);
  const d = destinoPermitido(lido ?? { view: painelDoPerfil(role) }, role);
  return { view: d.view, params: paramsDe(d) };
}

/** Um erro num ecrã não deita abaixo o resto da aplicação. */
class LimiteErro extends Component<{ chave: string; children: ReactNode }, { erro: Error | null }> {
  state = { erro: null as Error | null };
  static getDerivedStateFromError(erro: Error) { return { erro }; }
  componentDidUpdate(prev: { chave: string }) {
    if (prev.chave !== this.props.chave && this.state.erro) this.setState({ erro: null });
  }
  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div role="alert" className="max-w-xl mx-auto mt-10 bg-superficie border border-linha rounded-cartao p-6 text-center">
        <p className="m-0 font-semibold text-tinta">Este ecrã teve um problema.</p>
        <p className="m-0 mt-1 text-sm text-tinta-suave">Os dados estão guardados. Tente abrir de novo.</p>
        <Botao className="mt-4" variante="secundario" onClick={() => this.setState({ erro: null })}>Tentar de novo</Botao>
      </div>
    );
  }
}

export function AppShell() {
  const { user } = useAuth();
  const [estado, setEstado] = useState(() => arranque(user.role));
  const { view, params } = estado;
  const [menuAberto, setMenuAberto] = useState(false);
  const [pesquisaAberta, setPesquisaAberta] = useState(false);
  const primeiraEscrita = useRef(true);
  /** O navigate já escreveu o URL com filtros: o efeito abaixo não o reescreve. */
  const urlComFiltros = useRef(false);

  // URL ← estado
  useEffect(() => {
    const url = caminhoDaVista({ view, ...params }, params.drive ?? "");
    if (!url) return;
    const atual = `${window.location.pathname}${window.location.search}`;
    // Os filtros (useFiltrosUrl) também vivem na query: não se perdem ao reescrever.
    const base = url.split("?")[0];
    if (atual === url || (atual.split("?")[0] === base && (primeiraEscrita.current || urlComFiltros.current))) {
      primeiraEscrita.current = false;
      urlComFiltros.current = false;
      return;
    }
    window.history[primeiraEscrita.current ? "replaceState" : "pushState"](null, "", url);
    primeiraEscrita.current = false;
  }, [view, params]);

  // estado ← URL (botão "voltar")
  useEffect(() => {
    function voltar() {
      const lido = vistaDoCaminho(window.location.pathname, window.location.search);
      if (!lido) return;
      const d = destinoPermitido(lido, user.role);
      setEstado({ view: d.view, params: paramsDe(d) });
    }
    window.addEventListener("popstate", voltar);
    return () => window.removeEventListener("popstate", voltar);
  }, [user.role]);

  useEffect(() => {
    const depois = window.setTimeout(() => armViewLoading(), 2000);
    return () => window.clearTimeout(depois);
  }, []);

  const navigate = useCallback((alvo: Vista | Destino) => {
    const d = destinoPermitido(typeof alvo === "string" ? { view: alvo } : alvo, user.role);
    const novo = paramsDe(d);
    // Com filtros, o URL escreve-se já, para a vista de destino os ler ao montar.
    if (d.filtros && Object.keys(d.filtros).length) {
      const url = caminhoDaVista(d);
      if (url) {
        window.history.pushState(null, "", url);
        primeiraEscrita.current = false;
        urlComFiltros.current = true;
        window.dispatchEvent(new PopStateEvent("popstate"));
      }
    }
    // Mesma vista e mesmos parâmetros: não mexe (não perde os filtros do URL).
    setEstado(e => (e.view === d.view && JSON.stringify(e.params) === JSON.stringify(novo) ? e : { view: d.view, params: novo }));
    setMenuAberto(false);
    window.scrollTo({ top: 0 });
  }, [user.role]);

  const limpar = useCallback((chave: "formandoId" | "formadorId" | "leadId") => {
    setEstado(e => ({ ...e, params: { ...e.params, [chave]: undefined } }));
  }, []);

  // Ctrl+K abre a pesquisa
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPesquisaAberta(p => !p); }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  const Ecra = ROTAS[view] ?? ROTAS[painelDoPerfil(user.role)];
  const props: VistaProps = { view, params, navigate, limpar };

  return (
    <>
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[70] focus:bg-superficie focus:px-3 focus:py-2 focus:rounded-controlo">
        Saltar para o conteúdo
      </a>
      <div className="flex h-full bg-fundo">
        <aside className="hidden lg:flex w-60 shrink-0 h-full sticky top-0">
          <div className="w-full"><Sidebar view={view} onNavigate={navigate} /></div>
        </aside>

        {menuAberto && (
          <div className="fixed inset-0 z-40 lg:hidden bg-nav/60" onMouseDown={e => { if (e.target === e.currentTarget) setMenuAberto(false); }}>
            <aside className="w-64 h-full shadow-flutuante"><Sidebar view={view} onNavigate={navigate} onFechar={() => setMenuAberto(false)} /></aside>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 min-h-full">
          <Cabecalho view={view} params={params} navigate={navigate} onMenu={() => setMenuAberto(true)} onPesquisa={() => setPesquisaAberta(true)} />
          <div className="relative flex-1 min-h-0 overflow-clip">
            <main id="conteudo" tabIndex={-1} className="h-full overflow-auto px-4 py-5 sm:px-8 sm:py-6 outline-none">
              <LimiteErro chave={view}>
                <Suspense fallback={<Esqueleto linhas={8} className="max-w-3xl" />}>
                  {/* key: o mesmo ecrã serve Gold e Financiada; muda de regime → estado novo. */}
                  <Ecra key={view} {...props} />
                </Suspense>
              </LimiteErro>
            </main>
            <ViewLoadingOverlay />
            <FileDialogPaint />
          </div>
        </div>
      </div>

      <DocAlertas onOpen={(id, regime) => navigate({ view: regime === "fin" ? "fin-preinscricoes" : "gold-preinscricoes", leadId: id })} />
      <Pesquisa aberta={pesquisaAberta} onFechar={() => setPesquisaAberta(false)} onNavigate={navigate} />
    </>
  );
}
