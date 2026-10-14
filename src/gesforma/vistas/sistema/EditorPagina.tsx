// Sistema › Site: editor visual (Puck) de uma página do site. A pré-visualização é o próprio site,
// à largura escolhida; o rascunho grava-se sozinho e só "Publicar" o põe no site.
import "@puckeditor/core/puck.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { Puck, type Data, type Dictionary, type Viewports } from "@puckeditor/core";
import { apiPaginaSite, apiPublicarPagina, apiRascunhoPagina } from "../../../partilhado/api/site";
import { useRecurso } from "../../../partilhado/dados/useRecurso";
import type { PaginaSite } from "../../../partilhado/siteBlocos";
import { toastError, toastOk } from "../../../partilhado/toastBus";
import { ConfirmarPerigo, ErroCarregar, Esqueleto } from "../../../partilhado/ui";
import { OfertaCtx, useOfertaState } from "../../../site/SiteLanding";
import { nomesCursos } from "../../../site/editor/campos";
import { configSite } from "../../../site/editor/config";
import { modeloInicio } from "../../../site/editor/modeloBase";

const VIEWPORTS: Viewports = [
  { width: 390, height: "auto", label: "Telemóvel", icon: "Smartphone" },
  { width: 820, height: "auto", label: "Tablet", icon: "Tablet" },
  { width: 1440, height: "auto", label: "Computador", icon: "Monitor" },
  { width: "100%", height: "auto", label: "Largura toda" },
];

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

const TITULOS: Record<PaginaSite, string> = { inicio: "Página inicial", catalogo: "Catálogo", area: "Área do formando" };

type Estado = "guardado" | "a-guardar" | "por-guardar" | "erro";

export function EditorPagina({ pagina }: { pagina: PaginaSite }) {
  const { dados, erro, recarregar } = useRecurso(`site-pagina:${pagina}`, s => apiPaginaSite(pagina, s));
  const oferta = useOfertaState();
  const [versao, setVersao] = useState(0);
  const [reposto, setReposto] = useState<Data | null>(null);
  const [repor, setRepor] = useState(false);
  const [estado, setEstado] = useState<Estado>("guardado");
  const [publicadoEm, setPublicadoEm] = useState<string | null>(null);
  const [aPublicar, setAPublicar] = useState(false);
  const pendente = useRef<Data | null>(null);
  const temporizador = useRef<number | undefined>(undefined);

  useEffect(() => { for (const c of oferta.cursos) nomesCursos.set(c.id, c.title); }, [oferta.cursos]);
  useEffect(() => { if (dados) setPublicadoEm(dados.publicadoEm); }, [dados]);

  // Os dados só servem para montar o Puck; depois de montado é ele que manda (repor monta de novo).
  const inicial = useMemo<Data | null>(() => {
    if (reposto) return reposto;
    if (!dados) return null;
    const d = (dados.rascunho ?? dados.publicado) as Data | null;
    return d && Array.isArray(d.content) ? d : modeloInicio();
  }, [dados, reposto]);

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
      toastOk("Publicado. O site já mostra esta versão.");
    } catch (e) {
      toastError(e instanceof Error ? e.message : "Não foi possível publicar.");
    } finally {
      setAPublicar(false);
    }
  }

  // Grava o que faltar ao sair do ecrã.
  useEffect(() => () => { window.clearTimeout(temporizador.current); void gravarRascunho(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (erro) return <ErroCarregar erro={erro} onTentar={recarregar} />;
  if (!inicial) return <Esqueleto linhas={10} />;

  const textoEstado = { "guardado": "Rascunho guardado", "a-guardar": "A guardar…", "por-guardar": "Alterações por guardar", "erro": "Rascunho não guardado" }[estado];

  return (
    <OfertaCtx.Provider value={oferta}>
      <div className="editor-site h-full">
        <Puck
          key={versao}
          config={configSite}
          data={inicial}
          onChange={aoMudar}
          onPublish={d => void publicar(d)}
          headerTitle={TITULOS[pagina]}
          viewports={VIEWPORTS}
          iframe={{ enabled: true, waitForStyles: true }}
          dictionary={PT}
          height="100%"
          renderHeaderActions={({ state }) => (
            <div className="flex items-center gap-2 text-[12px]">
              <span className={estado === "erro" ? "text-[#a60000]" : "text-[#6b7685]"} aria-live="polite">{textoEstado}</span>
              <span className="hidden text-[#6b7685] xl:inline">{publicadoEm ? `· publicado ${new Date(publicadoEm).toLocaleString("pt-PT")}` : "· ainda não publicado"}</span>
              <button type="button" onClick={() => setRepor(true)} className="rounded border border-[#d4d8de] px-2.5 py-1.5 font-semibold text-[#3d4a5a] hover:bg-[#f2f4f7]">Repor modelo base</button>
              <a href="/" target="_blank" rel="noreferrer" className="rounded border border-[#d4d8de] px-2.5 py-1.5 font-semibold text-[#3d4a5a] hover:bg-[#f2f4f7]">Ver site ↗</a>
              <button type="button" disabled={aPublicar} onClick={() => void publicar(state.data as Data)}
                className="rounded bg-[#a60000] px-3.5 py-1.5 font-bold text-white hover:bg-[#14263d] disabled:opacity-60">{aPublicar ? "A publicar…" : "Publicar"}</button>
            </div>
          )}
        />
      </div>
      <ConfirmarPerigo
        aberto={repor}
        titulo="Repor o modelo base?"
        descricao="O rascunho volta ao modelo base. O site só muda quando publicar."
        acao="Repor"
        onFechar={() => setRepor(false)}
        onConfirmar={async () => {
          window.clearTimeout(temporizador.current);
          const base = modeloInicio();
          pendente.current = base;
          await gravarRascunho();
          setRepor(false);
          setReposto(base);
          setVersao(v => v + 1);
        }}
      />
    </OfertaCtx.Provider>
  );
}
