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
import { molduraDoSite } from "../../../site/PaginaSite";
import { OfertaCtx, useOfertaState } from "../../../site/SiteLanding";
import { nomesCursos } from "../../../site/editor/campos";
import { completarPadroes, configPara, MolduraCtx, type Moldura } from "../../../site/editor/config";
import {
  AvisoDispositivoCtx, definirDispositivoEmEdicao, dispositivoEmEdicao, NOMES_DISP, paraDispositivo, registarNoEcra, type Disp,
} from "../../../site/editor/dispositivos";
import { converterPaginaCurso, converterPaginaInicio, modeloPagina, molduraDeInicio } from "../../../site/editor/modeloBase";
import { fmtDataHoraLisboa } from "../../../partilhado/horaLisboa";

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
  inicio: { titulo: "Página inicial", endereco: "/", nota: "Também guarda o tema (cores e fontes) de todo o site." },
  moldura: { titulo: "Cabeçalho e rodapé", endereco: "/", nota: "O cabeçalho (logótipo, menu, botão) e o rodapé de todas as páginas do site." },
  catalogo: { titulo: "Catálogo", endereco: "/formacao", nota: "Lista de cursos com pesquisa e filtros." },
  curso: { titulo: "Página de curso", endereco: "/formacao", nota: "A página de cada curso (a mesma para todos)." },
  noticias: { titulo: "Notícias", endereco: "/noticias", nota: "Os artigos vêm de Gestão › Blog." },
  noticia: { titulo: "Página de notícia", endereco: "/noticias/…", nota: "A página de cada artigo (a mesma para todos; o texto escreve-se em Gestão › Blog)." },
  empresas: { titulo: "Empresas", endereco: "/empresas", nota: "Formação à medida para organizações." },
  servico: { titulo: "Página de serviço", endereco: "/empresas/…", nota: "A página de cada serviço (a mesma para todos; o conteúdo escreve-se em Gestão › Empresas / Business)." },
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
function SincronizarEcra({ ecra, dados, escrever, config }: { ecra: Disp | null; dados: Data; escrever: (d: Data) => void; config: Config }) {
  const ultimo = useRef<Disp | null>(null);
  useEffect(() => {
    if (!ecra || ecra === ultimo.current) return;
    ultimo.current = ecra;
    definirDispositivoEmEdicao(ecra);
    escrever(paraDispositivo(dados, ecra, slotsDe(config)));
  }, [ecra]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Guarda o dispatch do Puck (só existe dentro da barra) para o editor lhe devolver dados tratados. */
function GuardarDispatch({ dispatch, destino }: { dispatch: (a: PuckAction) => void; destino: { current: ((a: PuckAction) => void) | null } }) {
  destino.current = dispatch;
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
    // Todas as páginas mostram o cabeçalho e o rodapé partilhados (o rascunho, para se ver o que se está a mudar)
    // e o tema da página inicial.
    const inicio = pagina === "inicio" ? null : apiPaginaSite("inicio", ctl.signal);
    const moldura = pagina === "moldura" ? null : apiPaginaSite("moldura", ctl.signal);
    Promise.all([apiPaginaSite(pagina, ctl.signal), inicio, moldura])
      .then(([d, i, m]) => {
        const doInicio = ((pagina === "inicio" ? d : i)?.rascunho ?? (pagina === "inicio" ? d : i)?.publicado) as Data | null;
        const daMoldura = (m?.rascunho ?? m?.publicado) as Data | null;
        // «Cabeçalho e rodapé» ainda vazio: começa com os da página inicial.
        if (pagina === "moldura" && !d.rascunho && !d.publicado) {
          const base = molduraDeInicio(doInicio);
          if (base) d = { ...d, rascunho: base as never };
        }
        setDados(d);
        setMoldura(molduraDoSite(doInicio ?? modeloPagina("inicio"), pagina === "moldura" ? null : daMoldura));
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
  /** Página nunca publicada aberta num rascunho: o site mostra o modelo base, não este rascunho. */
  const [rascunhoSoltoEm, setRascunhoSoltoEm] = useState<string | null>(null);
  const [aPublicar, setAPublicar] = useState(false);
  const [ecra, setEcra] = useState<Disp | null>(null);
  const config = configPara(pagina);
  const pendente = useRef<Data | null>(null);
  const temporizador = useRef<number | undefined>(undefined);
  /** Último conteúdo visto: o Puck chama onChange também em mudanças de interface (painel, seleção). */
  const ultimo = useRef("");
  /** Dados já com as variantes por ecrã registadas, e o dispatch do Puck para lhe devolver as variantes. */
  const anterior = useRef<Data | null>(null);
  const dispatchRef = useRef<((a: PuckAction) => void) | null>(null);
  // O Puck reinicia-se quando a lista de plugins muda: tem de ser a mesma em todos os renders.
  const irParaRef = useRef<(p: PaginaSite) => void>(() => undefined);
  const plugins = useMemo(() => [pluginPaginas(pagina, p => irParaRef.current(p))], [pagina]);

  useEffect(() => { for (const c of oferta.cursos) nomesCursos.set(c.id, c.title); }, [oferta.cursos]);
  // Os dados só montam o Puck; depois de montado é ele que manda (repor monta de novo).
  useEffect(() => {
    if (!dados || inicial) return;
    setPublicadoEm(dados.publicadoEm);
    setRascunhoSoltoEm(!dados.publicado && dados.rascunho ? dados.atualizadoEm ?? "" : null);
    const d = (dados.rascunho ?? dados.publicado) as Data | null;
    // A página do curso antiga (um só bloco) abre já partida em blocos que se editam um a um.
    const base = completarPadroes(d && Array.isArray(d.content) ? (pagina === "curso" ? converterPaginaCurso(d) : pagina === "inicio" ? converterPaginaInicio(d) : d) : modeloPagina(pagina));
    ultimo.current = JSON.stringify(base);
    anterior.current = base;
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

  /** Escreve no Puck dados já tratados (variantes por ecrã) sem os voltar a tratar. */
  function escrever(d: Data) {
    anterior.current = d;
    dispatchRef.current?.({ type: "setData", data: d });
  }

  function aoMudar(recebido: Data) {
    // Regista no ecrã em edição o que mudou; se as variantes mudaram, devolve-as ao Puck.
    const tratado = registarNoEcra(recebido, anterior.current, dispositivoEmEdicao(), slotsDe(config));
    const d = tratado ?? recebido;
    anterior.current = d;
    if (tratado) dispatchRef.current?.({ type: "setData", data: tratado });
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
  const escreverRef = useRef(escrever);
  escreverRef.current = escrever;
  const aoMudarRef = useRef(aoMudar);
  aoMudarRef.current = aoMudar;
  const onChange = useCallback((d: Data) => aoMudarRef.current(d), []);
  const onPublish = useCallback((d: Data) => void publicarRef.current(d), []);

  /** O rascunho passa a ser o modelo base (o que o site mostra enquanto a página não for publicada). */
  async function reporModelo() {
    window.clearTimeout(temporizador.current);
    const base = completarPadroes(modeloPagina(pagina));
    pendente.current = base;
    await gravarRascunho();
    ultimo.current = JSON.stringify(base);
    setRascunhoSoltoEm(null);
    setInicial(base);
    setVersao(v => v + 1);
  }

  // Grava o que faltar ao sair do ecrã.
  useEffect(() => () => { window.clearTimeout(temporizador.current); void gravarRascunho(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const textoEstado = { "guardado": "Rascunho guardado", "a-guardar": "A guardar…", "por-guardar": "Alterações por guardar", "erro": "Rascunho não guardado" }[estado];
  // Estável entre renders (o Puck reage a overrides novos): só muda quando o que mostra muda.
  const acoes = useCallback(({ state, dispatch }: { state: { data: unknown }; dispatch: (a: PuckAction) => void }) => (
    <div className="flex items-center gap-2 text-[12px]">
      <GuardarDispatch dispatch={dispatch} destino={dispatchRef} />
      <SincronizarEcra ecra={ecra} dados={state.data as Data} escrever={d => escreverRef.current(d)} config={config} />
      {ecra && <span className={`rounded px-2 py-1 font-semibold ${ecra === "pc" ? "bg-[#eef1f5] text-[#3d4a5a]" : "bg-[#fff1d1] text-[#7a4b00]"}`} title="O ecrã da pré-visualização decide o que se edita">A editar: {NOMES_DISP[ecra]}</span>}
      <span className={estado === "erro" ? "text-[#a60000]" : "text-[#6b7685]"} aria-live="polite">{textoEstado}</span>
      <span className="hidden text-[#6b7685] xl:inline">{publicadoEm ? `· publicada ${fmtDataHoraLisboa(publicadoEm)}` : "· ainda não publicada"}</span>
      <button type="button" onClick={() => setRepor(true)} className="rounded border border-[#d4d8de] px-2.5 py-1.5 font-semibold text-[#3d4a5a] hover:bg-[#f2f4f7]">Repor modelo base</button>
      <a href={PAGINAS[pagina].endereco} target="_blank" rel="noreferrer" className="rounded border border-[#d4d8de] px-2.5 py-1.5 font-semibold text-[#3d4a5a] hover:bg-[#f2f4f7]">Ver no site ↗</a>
      <button type="button" disabled={aPublicar} onClick={() => void publicarRef.current(state.data as Data)}
        className="rounded bg-[#a60000] px-3.5 py-1.5 font-bold text-white hover:bg-[#14263d] disabled:opacity-60">{aPublicar ? "A publicar…" : "Publicar"}</button>
    </div>
  ), [estado, textoEstado, publicadoEm, aPublicar, pagina, ecra, config]);

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!inicial || !moldura) return <Esqueleto linhas={10} className="m-6" />;

  return (
    <OfertaCtx.Provider value={oferta}>
      <MolduraCtx.Provider value={moldura}>
      <AvisoDispositivoCtx.Provider value={setEcra}>
        <div className="editor-site flex h-full flex-col">
          {rascunhoSoltoEm != null && (
            <div role="status" className="flex flex-wrap items-center gap-3 border-b border-[#f0d58a] bg-[#fff8e1] px-4 py-2 text-[13px] text-[#5c4300]">
              <span>
                Esta página nunca foi publicada: o site mostra o modelo base. Está a ver um rascunho
                {rascunhoSoltoEm ? ` guardado a ${fmtDataHoraLisboa(rascunhoSoltoEm)}` : ""}, que pode ser diferente.
              </span>
              <button type="button" onClick={() => void reporModelo()} className="rounded border border-[#d9b75a] bg-white px-2.5 py-1 font-semibold hover:bg-[#fff1c2]">Abrir o que o site mostra</button>
              <button type="button" onClick={() => setRascunhoSoltoEm(null)} className="font-semibold underline">Continuar no rascunho</button>
            </div>
          )}
          <div className="min-h-0 flex-1">
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
        </div>
        <ConfirmarPerigo
          aberto={repor}
          titulo={`Repor o modelo base de «${PAGINAS[pagina].titulo}»?`}
          descricao="O rascunho desta página volta ao modelo base. O site só muda quando publicar."
          acao="Repor"
          onFechar={() => setRepor(false)}
          onConfirmar={async () => { await reporModelo(); setRepor(false); }}
        />
      </AvisoDispositivoCtx.Provider>
      </MolduraCtx.Provider>
    </OfertaCtx.Provider>
  );
}
