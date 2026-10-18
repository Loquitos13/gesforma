import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { recarregarSeVersaoNova } from "./partilhado/versaoNova";

// Depois de um deploy, um separador aberto pede ficheiros da versão anterior que já não existem.
window.addEventListener("vite:preloadError", e => { if (recarregarSeVersaoNova(e.payload)) e.preventDefault(); });

// Cada página carrega só o seu código: o site público não descarrega o backoffice e vice-versa.
const Backoffice = lazy(() => import("./gesforma/Backoffice").then(m => ({ default: m.Backoffice })));
const PublicFaturacao = lazy(() => import("./site/PublicFaturacao").then(m => ({ default: m.PublicFaturacao })));
const PublicInquerito = lazy(() => import("./site/PublicInquerito").then(m => ({ default: m.PublicInquerito })));
const PublicPreinscricao = lazy(() => import("./site/PublicPreinscricao").then(m => ({ default: m.PublicPreinscricao })));
const PublicDocumentos = lazy(() => import("./site/PublicDocumentos").then(m => ({ default: m.PublicDocumentos })));
const PublicFormandoDocumentos = lazy(() => import("./site/PublicFormandoDocumentos").then(m => ({ default: m.PublicFormandoDocumentos })));
const PublicCronograma = lazy(() => import("./site/PublicCronograma").then(m => ({ default: m.PublicCronograma })));
const AssinarContrato = lazy(() => import("./site/AssinarContrato").then(m => ({ default: m.AssinarContrato })));
const VerificarAssinatura = lazy(() => import("./site/VerificarAssinatura").then(m => ({ default: m.VerificarAssinatura })));
const Noticias = lazy(() => import("./site/Noticias").then(m => ({ default: m.Noticias })));
const SiteLanding = lazy(() => import("./site/SiteLandingRodape").then(m => ({ default: m.SiteLanding })));
const PaginaDoSite = lazy(() => import("./site/SiteLandingRodape").then(m => ({ default: m.PaginaDoSite })));

const path = window.location.pathname.replace(/\/+$/, "") || "/";
const legacyEntrar = path === "/entrar" || path.startsWith("/entrar/");
if (legacyEntrar) {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("destino")) params.set("destino", "/gesforma/gold");
  window.location.replace(`/area-formando?${params.toString()}`);
}
const entrar = path.startsWith("/gesforma");
const areaFormando = legacyEntrar || path === "/area-formando" || path.startsWith("/area-formando/");
const noticiaSlug = path.startsWith("/noticias/") ? decodeURIComponent(path.slice("/noticias/".length).split("/")[0] ?? "") : "";
const noticias = path === "/noticias";
const catalogo = path === "/formacao";
const empresas = path === "/empresas";
const slugServico = path.startsWith("/empresas/") ? decodeURIComponent(path.slice("/empresas/".length).split("/")[0] ?? "") : "";
const slugCurso = path.startsWith("/formacao/") ? decodeURIComponent(path.slice("/formacao/".length).split("/")[0] ?? "") : "";
const publicForm = path === "/pre-inscricao";
const docsToken = path.startsWith("/documentos/") && !path.startsWith("/documentos-formando/")
  ? decodeURIComponent(path.slice("/documentos/".length).split("/")[0] ?? "")
  : "";
const formandoDocsToken = path.startsWith("/documentos-formando/")
  ? decodeURIComponent(path.slice("/documentos-formando/".length).split("/")[0] ?? "")
  : "";
const cronogramaMatch = path.match(/^\/cronograma\/(gold|fin)\/(\d+)$/);
const assinarToken = path.startsWith("/assinar/") ? decodeURIComponent(path.slice("/assinar/".length).split("/")[0] ?? "") : "";
const verificar = path === "/verificar" || path.startsWith("/verificar/");
const verificarCodigo = path.startsWith("/verificar/") ? decodeURIComponent(path.slice("/verificar/".length).split("/")[0] ?? "") : "";
const faturacaoToken = path.startsWith("/faturacao/") ? decodeURIComponent(path.slice("/faturacao/".length).split("/")[0] ?? "") : "";
const inqToken = path.startsWith("/inquerito/") ? decodeURIComponent(path.slice("/inquerito/".length).split("/")[0] ?? "") : "";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={null}>
      {assinarToken ? (
        <AssinarContrato token={assinarToken} />
      ) : verificar ? (
        <VerificarAssinatura codigo={verificarCodigo} />
      ) : publicForm ? (
        <PublicPreinscricao />
      ) : cronogramaMatch ? (
        <PublicCronograma regime={cronogramaMatch[1] as "gold" | "fin"} turmaId={Number(cronogramaMatch[2])} />
      ) : formandoDocsToken ? (
        <PublicFormandoDocumentos token={formandoDocsToken} />
      ) : docsToken ? (
        <PublicDocumentos token={docsToken} />
      ) : faturacaoToken ? (
        <PublicFaturacao token={faturacaoToken} />
      ) : inqToken ? (
        <PublicInquerito token={inqToken} />
      ) : areaFormando ? (
        <PaginaDoSite pagina="area" />
      ) : noticias ? (
        <PaginaDoSite pagina="noticias" />
      ) : noticiaSlug ? (
        <Noticias slug={noticiaSlug} />
      ) : empresas ? (
        <PaginaDoSite pagina="empresas" />
      ) : slugServico ? (
        <PaginaDoSite pagina="servico" slug={slugServico} />
      ) : entrar ? (
        <Backoffice />
      ) : slugCurso ? (
        <PaginaDoSite pagina="curso" slug={slugCurso} />
      ) : catalogo ? (
        <PaginaDoSite pagina="catalogo" />
      ) : (
        <SiteLanding />
      )}
    </Suspense>
  </StrictMode>,
);
