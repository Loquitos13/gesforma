import { Component, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "../../partilhado/AuthGate";
import { recarregarSeVersaoNova } from "../../partilhado/versaoNova";
import { Botao, cx, Esqueleto } from "../../partilhado/ui";
import { DocAlertas } from "../DocAlertas";
import { tabDoFormador } from "../vistas/turmas/cockpit/base";
import { caminhoDaVista, vistaDoCaminho, type Destino, type Vista } from "../rotasGesforma";
import { FileDialogPaint } from "../ViewLoading";
import { Cabecalho } from "./Cabecalho";
import { painelDoPerfil, vistaNoMenuDoPerfil, VISTAS_FORMADOR } from "./navegacao";
import { Pesquisa } from "./Pesquisa";
import { ROTAS } from "./rotas";
import { Sidebar } from "./Sidebar";
import type { ParamsVista, VistaProps } from "./tipos";

function paramsDe(d: Partial<Destino>, drive?: string): ParamsVista {
  return {
    // A Financiada abre no Cronograma (por dias); a Gold na visão geral.
    tab: d.tab ?? (d.view === "fin-cockpit-turma" ? "sessoes" : "overview"),
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

/** Parâmetros da query que só o estado da navegação escreve (os outros são filtros dos ecrãs). */
const CHAVES_DO_ESTADO = ["separador", "formando", "origem", "formador", "lead", "drive"];

/** O URL actual já corresponde ao estado? Mesmo caminho, mesmos parâmetros do estado; o resto da query fica. */
function urlRepresentaEstado(url: string) {
  const [base, query = ""] = url.split("?");
  if (window.location.pathname !== base) return false;
  const quer = new URLSearchParams(query);
  const tem = new URLSearchParams(window.location.search);
  for (const [k, v] of quer) if (tem.get(k) !== v) return false;
  return CHAVES_DO_ESTADO.every(k => quer.has(k) || !tem.has(k));
}

/** Um erro num ecrã não deita abaixo o resto da aplicação. */
class LimiteErro extends Component<{ chave: string; children: ReactNode }, { erro: Error | null }> {
  state = { erro: null as Error | null };
  static getDerivedStateFromError(erro: Error) { return { erro }; }
  componentDidCatch(erro: Error) {
    console.error("[ecrã] erro", erro);
    recarregarSeVersaoNova(erro);
  }
  componentDidUpdate(prev: { chave: string }) {
    if (prev.chave !== this.props.chave && this.state.erro) this.setState({ erro: null });
  }
  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <div role="alert" className="max-w-xl mx-auto mt-10 bg-superficie border border-linha rounded-cartao p-6 text-center">
        <p className="m-0 font-semibold text-tinta">Este ecrã teve um problema.</p>
        <p className="m-0 mt-1 text-sm text-tinta-suave">Os dados estão guardados. Tente abrir de novo; se voltar a acontecer, atualize a página.</p>
        <div className="mt-4 flex justify-center gap-2">
          <Botao variante="secundario" onClick={() => this.setState({ erro: null })}>Tentar de novo</Botao>
          <Botao variante="secundario" onClick={() => window.location.reload()}>Atualizar a página</Botao>
        </div>
        {/* Detalhe técnico, para quem reporta o problema. */}
        <p className="m-0 mt-4 break-words text-[11px] text-tinta-suave">{String(this.state.erro.message || this.state.erro).slice(0, 300)}</p>
      </div>
    );
  }
}

export function AppShell() {
  const { user } = useAuth();
  const [estado, setEstado] = useState(() => arranque(user.role));
  const { view, params } = estado;
  const [menuAberto, setMenuAberto] = useState(false);
  const [recolhida, setRecolhida] = useState(() => { try { return localStorage.getItem("gf-nav-recolhida") === "1"; } catch { return false; } });
  const alternarNav = useCallback(() => setRecolhida(r => {
    try { localStorage.setItem("gf-nav-recolhida", r ? "0" : "1"); } catch { /* sem armazenamento: fica só nesta sessão */ }
    return !r;
  }), []);
  const [pesquisaAberta, setPesquisaAberta] = useState(false);
  const primeiraEscrita = useRef(true);

  // URL ← estado. Idempotente: se o URL já representa o estado não se escreve nada, e os filtros e
  // outros parâmetros da query (useFiltrosUrl, ?editar=…) mantêm-se, também quando o efeito corre duas vezes.
  useEffect(() => {
    const url = caminhoDaVista({ view, ...params }, params.drive ?? "");
    if (!url) return;
    if (urlRepresentaEstado(url)) {
      primeiraEscrita.current = false;
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

  const navigate = useCallback((alvo: Vista | Destino) => {
    const d = destinoPermitido(typeof alvo === "string" ? { view: alvo } : alvo, user.role);
    const novo = paramsDe(d);
    // Com filtros, o URL escreve-se já, para a vista de destino os ler ao montar.
    if (d.filtros && Object.keys(d.filtros).length) {
      const url = caminhoDaVista(d);
      if (url) {
        window.history.pushState(null, "", url);
        primeiraEscrita.current = false;
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
        <aside className={cx("hidden lg:flex shrink-0 h-full sticky top-0 transition-[width] duration-150", recolhida ? "w-14" : "w-60")}>
          <div className="w-full"><Sidebar view={view} onNavigate={navigate} compacta={recolhida} onAlternar={alternarNav} /></div>
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
            <FileDialogPaint />
          </div>
        </div>
      </div>

      <DocAlertas onOpen={(id, regime) => navigate({ view: regime === "fin" ? "fin-preinscricoes" : "gold-preinscricoes", leadId: id })} />
      <Pesquisa aberta={pesquisaAberta} onFechar={() => setPesquisaAberta(false)} onNavigate={navigate} />
    </>
  );
}
