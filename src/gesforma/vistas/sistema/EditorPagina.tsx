// Sistema › Site: editor visual (Puck) das páginas do site. A pré-visualização é o próprio site,
// à largura escolhida; o rascunho grava-se sozinho e só "Publicar" o põe no site.
// O ícone "Páginas" (por baixo de Blocos e Estrutura) escolhe a página a editar.
import "@puckeditor/core/no-external.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Puck, type Config, type Data, type Dictionary, type Plugin, type PuckAction, type Viewports } from "@puckeditor/core";
import { apiPaginaSite, apiPublicarPagina, apiRascunhoPagina, type PaginaEditor } from "../../../partilhado/api/site";
import { PAGINAS_SITE, type PaginaSite } from "../../../partilhado/siteBlocos";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { ConfirmarPerigo, ErroCarregar, Esqueleto } from "../../../partilhado/ui";
import { molduraDaPagina } from "../../../site/PaginaSite";
import { OfertaCtx, useOfertaState } from "../../../site/SiteLanding";
import { nomesCursos } from "../../../site/editor/campos";
import { configPara, MolduraCtx, type Moldura } from "../../../site/editor/config";
import {
  AvisoDispositivoCtx, definirDispositivoEmEdicao, NOMES_DISP, paraDispositivo, type Disp,
} from "../../../site/editor/dispositivos";
import { modeloPagina } from "../../../site/editor/modeloBase";

const VIEWPORTS: Viewports = [
  { width: 390, height: "auto", label: "Telemóvel", icon: "Smartphone" },
  { width: 820, height: "auto", label: "Tablet", icon: "Tablet" },
  { width: 1440, height: "auto", label: "Computador", icon: "Monitor" },
  { width: "100%", height: "auto", label: "Largura toda" },
];

// Constantes fora do componente: o Puck repõe o ecrã da pré-visualização se estes objectos mudarem.
const IFRAME = { enabled: true, waitForStyles: true };

const PT: Dictionary = {
  "header-publish": "Publicar", "header-undo": "anular", "header-redo": "refazer",
  "header-toggle-leftsidebar": "Mostrar/esconder blocos", "header-toggle-rightsidebar": "Mostrar/esconder propriedades", "header-toggle-menubar": "Mostrar/esconder menu",
  "action-selectparent": "Selecionar o bloco de fora", "action-duplicate": "Duplicar", "action-delete": "Apagar",
  "label-page": "Página", "label-component": "Bloco",
  "outline-empty": "Sem blocos", "outline-item-collapse": "Recolher", "outline-item-expand": "Expandir", "outline-header-title": "Estrutura",
  "outline-header-collapseall": "Recolher tudo", "outline-item-duplicate": "Duplicar", "outline-item-delete": "Apagar",
  "drawer-category-collapse": "Recolher {title}", "drawer-category-expand": "Expandir {title}", "drawer-category-other": "Outros",
  "canvas-noconfig": "Bloco sem configuração: {type}", "field-readonly": "Só leitura",
  "field-arrayitem-summary": "Item {index}", "field-arrayitem-duplicate": "Duplicar", "field-arrayitem-delete": "Apagar",
  "viewport-zoom-in": "Aumentar", "viewport-zoom-out": "Diminuir", "viewport-zoom-auto": "{zoom}% (ajustado)",
  "viewport-toggle-menu": "Tamanhos de ecrã", "viewport-switch": "Ver como {label}", "viewport-switch-default": "Mudar o tamanho de ecrã",
  "plugin-blocks": "Blocos", "plugin-outline": "Estrutura", "plugin-fields": "Propriedades", "plugin-components": "Blocos",
  "layout-maximize": "maximizar", "layout-minimize": "minimizar", "loader-loading": "a carregar",
};

export const PAGINAS: Record<PaginaSite, { titulo: string; endereco: string; nota: string }> = {
  inicio: { titulo: "Página inicial", endereco: "/", nota: "Também guarda o cabeçalho, o rodapé e o tema de todo o site." },
  catalogo: { titulo: "Catálogo", endereco: "/formacao", nota: "Lista de cursos com pesquisa e filtros." },
  noticias: { titulo: "Notícias", endereco: "/noticias", nota: "Os artigos vêm de Gestão › Blog." },
  empresas: { titulo: "Empresas", endereco: "/empresas", nota: "Formação à medida para organizações." },
  area: { titulo: "Área do formando", endereco: "/area-formando", nota: "Painel do formando (cursos, agenda, certificados) e entrada." },
};

const IconePaginas = (
  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3h8l4 4v11a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" /><path d="M15 3v5h5" /><path d="M9 13h6M9 17h4" />
  </svg>
);

function pluginPaginas(atual: PaginaSite, ir: (p: PaginaSite) => void): Plugin {
  return {
    name: "paginas",
    label: "Páginas",
    icon: IconePaginas,
    render: () => (
      <nav aria-label="Páginas do site" className="flex flex-col gap-1 p-3">
        <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-[#6b7685]">Páginas do site</p>
        {PAGINAS_SITE.map(p => (
          <button key={p} type="button" onClick={() => ir(p)} aria-current={p === atual ? "page" : undefined}
            className={`rounded-md border px-3 py-2.5 text-left ${p === atual ? "border-[#3b6fd8] bg-[#eef3fd]" : "border-[#e1e5ea] bg-white hover:border-[#9fb4dd]"}`}>
            <span className="block text-[13px] font-semibold text-[#1c2633]">{PAGINAS[p].titulo}</span>
            <span className="block text-[11px] text-[#6b7685]">{PAGINAS[p].endereco} · {PAGINAS[p].nota}</span>
          </button>
        ))}
      </nav>
    ),
  };
}

type Estado = "guardado" | "a-guardar" | "por-guardar" | "erro";

const slotsDe = (config: Config) => (tipo: string) =>
  Object.entries(config.components[tipo]?.fields ?? {}).filter(([, f]) => (f as { type?: string }).type === "slot").map(([k]) => k);

/**
 * Quando a pré-visualização muda de ecrã, o painel passa a mostrar (e a editar) os valores desse ecrã.
 * Fica dentro da barra do Puck para ter os dados actuais e o dispatch.
 */
function SincronizarEcra({ ecra, dados, dispatch, config }: { ecra: Disp | null; dados: Data; dispatch: (a: PuckAction) => void; config: Config }) {
  const ultimo = useRef<Disp | null>(null);
  useEffect(() => {
    if (!ecra || ecra === ultimo.current) return;
    ultimo.current = ecra;
    definirDispositivoEmEdicao(ecra);
    dispatch({ type: "setData", data: paraDispositivo(dados, ecra, slotsDe(config)) });
  }, [ecra]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Lê a página sempre do servidor (sem cache): o rascunho tem de ser o último gravado. */
function usePaginaEditor(pagina: PaginaSite) {
  const [dados, setDados] = useState<PaginaEditor | null>(null);
  const [moldura, setMoldura] = useState<Moldura | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    const ctl = new AbortController();
    setErro(null);
    const inicio = pagina === "inicio" ? Promise.resolve(null) : apiPaginaSite("inicio", ctl.signal);
    Promise.all([apiPaginaSite(pagina, ctl.signal), inicio])
      .then(([d, i]) => {
        setDados(d);
        if (i) setMoldura(molduraDaPagina(((i.rascunho ?? i.publicado) as Data | null) ?? modeloPagina("inicio")));
      })
      .catch(e => { if (!ctl.signal.aborted) setErro(e); });
    return () => ctl.abort();
  }, [pagina, tentativa]);
  return { dados, moldura, erro, recarregar: () => setTentativa(t => t + 1) };
}

export function EditorPagina({ pagina, onMudarPagina }: { pagina: PaginaSite; onMudarPagina: (p: PaginaSite) => void }) {
  const { dados, moldura, erro, recarregar } = usePaginaEditor(pagina);
  const oferta = useOfertaState();
  const [versao, setVersao] = useState(0);
  const [inicial, setInicial] = useState<Data | null>(null);
  const [repor, setRepor] = useState(false);
  const [estado, setEstado] = useState<Estado>("guardado");
  const [publicadoEm, setPublicadoEm] = useState<string | null>(null);
  const [aPublicar, setAPublicar] = useState(false);
  const [ecra, setEcra] = useState<Disp | null>(null);
  const config = configPara(pagina);
  const pendente = useRef<Data | null>(null);
  const temporizador = useRef<number | undefined>(undefined);
  /** Último conteúdo visto: o Puck chama onChange também em mudanças de interface (painel, seleção). */
  const ultimo = useRef("");
  // O Puck reinicia-se quando a lista de plugins muda: tem de ser a mesma em todos os renders.
  const irParaRef = useRef<(p: PaginaSite) => void>(() => undefined);
  const plugins = useMemo(() => [pluginPaginas(pagina, p => irParaRef.current(p))], [pagina]);

  useEffect(() => { for (const c of oferta.cursos) nomesCursos.set(c.id, c.title); }, [oferta.cursos]);
  // Os dados só montam o Puck; depois de montado é ele que manda (repor monta de novo).
  useEffect(() => {
    if (!dados || inicial) return;
    setPublicadoEm(dados.publicadoEm);
    const d = (dados.rascunho ?? dados.publicado) as Data | null;
    const base = d && Array.isArray(d.content) ? d : modeloPagina(pagina);
    ultimo.current = JSON.stringify(base);
    setInicial(base);
  }, [dados, inicial, pagina]);

  async function gravarRascunho() {
    const d = pendente.current;
    if (!d) return;
    pendente.current = null;
    setEstado("a-guardar");
    try {
      await apiRascunhoPagina(pagina, d);
      setEstado(pendente.current ? "por-guardar" : "guardado");
    } catch {
      pendente.current ??= d;
      setEstado("erro");
    }
  }

  function aoMudar(d: Data) {
    const j = JSON.stringify(d);
    if (j === ultimo.current) return;
    ultimo.current = j;
    pendente.current = d;
    setEstado("por-guardar");
    window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => void gravarRascunho(), 1500);
  }

  async function publicar(d: Data) {
    window.clearTimeout(temporizador.current);
    pendente.current = null;
    setAPublicar(true);
    try {
      await apiPublicarPagina(pagina, d);
      setEstado("guardado");
      setPublicadoEm(new Date().toISOString());
      toastOk(`${PAGINAS[pagina].titulo} publicada. O site já mostra esta versão.`);
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Não foi possível publicar.");
    } finally {
      setAPublicar(false);
    }
  }

  /** Muda de página só depois de gravar o rascunho desta. */
  async function irPara(p: PaginaSite) {
    if (p === pagina) return;
    window.clearTimeout(temporizador.current);
    await gravarRascunho();
    onMudarPagina(p);
  }

  irParaRef.current = p => void irPara(p);
  const publicarRef = useRef(publicar);
  publicarRef.current = publicar;
  const aoMudarRef = useRef(aoMudar);
  aoMudarRef.current = aoMudar;
  const onChange = useCallback((d: Data) => aoMudarRef.current(d), []);
  const onPublish = useCallback((d: Data) => void publicarRef.current(d), []);

  // Grava o que faltar ao sair do ecrã.
  useEffect(() => () => { window.clearTimeout(temporizador.current); void gravarRascunho(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const textoEstado = { "guardado": "Rascunho guardado", "a-guardar": "A guardar…", "por-guardar": "Alterações por guardar", "erro": "Rascunho não guardado" }[estado];
  // Estável entre renders (o Puck reage a overrides novos): só muda quando o que mostra muda.
  const acoes = useCallback(({ state, dispatch }: { state: { data: unknown }; dispatch: (a: PuckAction) => void }) => (
    <div className="flex items-center gap-2 text-[12px]">
      <SincronizarEcra ecra={ecra} dados={state.data as Data} dispatch={dispatch} config={config} />
      {ecra && <span className={`rounded px-2 py-1 font-semibold ${ecra === "pc" ? "bg-[#eef1f5] text-[#3d4a5a]" : "bg-[#fff1d1] text-[#7a4b00]"}`} title="O ecrã da pré-visualização decide o que se edita">A editar: {NOMES_DISP[ecra]}</span>}
      <span className={estado === "erro" ? "text-[#a60000]" : "text-[#6b7685]"} aria-live="polite">{textoEstado}</span>
      <span className="hidden text-[#6b7685] xl:inline">{publicadoEm ? `· publicada ${new Date(publicadoEm).toLocaleString("pt-PT")}` : "· ainda não publicada"}</span>
      <button type="button" onClick={() => setRepor(true)} className="rounded border border-[#d4d8de] px-2.5 py-1.5 font-semibold text-[#3d4a5a] hover:bg-[#f2f4f7]">Repor modelo base</button>
      <a href={PAGINAS[pagina].endereco} target="_blank" rel="noreferrer" className="rounded border border-[#d4d8de] px-2.5 py-1.5 font-semibold text-[#3d4a5a] hover:bg-[#f2f4f7]">Ver no site ↗</a>
      <button type="button" disabled={aPublicar} onClick={() => void publicarRef.current(state.data as Data)}
        className="rounded bg-[#a60000] px-3.5 py-1.5 font-bold text-white hover:bg-[#14263d] disabled:opacity-60">{aPublicar ? "A publicar…" : "Publicar"}</button>
    </div>
  ), [estado, textoEstado, publicadoEm, aPublicar, pagina, ecra, config]);

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!inicial || (pagina !== "inicio" && !moldura)) return <Esqueleto linhas={10} className="m-6" />;

  return (
    <OfertaCtx.Provider value={oferta}>
      <MolduraCtx.Provider value={moldura}>
      <AvisoDispositivoCtx.Provider value={setEcra}>
        <div className="editor-site h-full">
          <Puck
            key={versao}
            config={config}
            data={inicial}
            onChange={onChange}
            onPublish={onPublish}
            headerTitle={PAGINAS[pagina].titulo}
            viewports={VIEWPORTS}
            iframe={IFRAME}
            dictionary={PT}
            plugins={plugins}
            height="100%"
            renderHeaderActions={acoes}
          />
        </div>
        <ConfirmarPerigo
          aberto={repor}
          titulo={`Repor o modelo base de «${PAGINAS[pagina].titulo}»?`}
          descricao="O rascunho desta página volta ao modelo base. O site só muda quando publicar."
          acao="Repor"
          onFechar={() => setRepor(false)}
          onConfirmar={async () => {
            window.clearTimeout(temporizador.current);
            const base = modeloPagina(pagina);
            pendente.current = base;
            await gravarRascunho();
            setRepor(false);
            ultimo.current = JSON.stringify(base);
            setInicial(base);
            setVersao(v => v + 1);
          }}
        />
      </AvisoDispositivoCtx.Provider>
      </MolduraCtx.Provider>
    </OfertaCtx.Provider>
  );
}
