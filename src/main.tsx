import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

// Cada página carrega só o seu código: o site público não descarrega o backoffice e vice-versa.
const Backoffice = lazy(() => import("./gesforma/Backoffice").then(m => ({ default: m.Backoffice })));
const PublicInquerito = lazy(() => import("./site/PublicInquerito").then(m => ({ default: m.PublicInquerito })));
const PublicPreinscricao = lazy(() => import("./site/PublicPreinscricao").then(m => ({ default: m.PublicPreinscricao })));
const PublicDocumentos = lazy(() => import("./site/PublicDocumentos").then(m => ({ default: m.PublicDocumentos })));
const PublicFormandoDocumentos = lazy(() => import("./site/PublicFormandoDocumentos").then(m => ({ default: m.PublicFormandoDocumentos })));
const PublicCronograma = lazy(() => import("./site/PublicCronograma").then(m => ({ default: m.PublicCronograma })));
const AssinarContrato = lazy(() => import("./site/AssinarContrato").then(m => ({ default: m.AssinarContrato })));
const VerificarAssinatura = lazy(() => import("./site/VerificarAssinatura").then(m => ({ default: m.VerificarAssinatura })));
const SiteCatalog = lazy(() => import("./site/SiteCatalog").then(m => ({ default: m.SiteCatalog })));
const SiteCurso = lazy(() => import("./site/SiteCurso").then(m => ({ default: m.SiteCurso })));
const AreaFormando = lazy(() => import("./site/AreaFormandoPainel").then(m => ({ default: m.AreaFormando })));
const Noticias = lazy(() => import("./site/Noticias").then(m => ({ default: m.Noticias })));
const SiteLanding = lazy(() => import("./site/SiteLandingRodape").then(m => ({ default: m.SiteLanding })));

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
      ) : inqToken ? (
        <PublicInquerito token={inqToken} />
      ) : areaFormando ? (
        <AreaFormando />
      ) : noticias || noticiaSlug ? (
        <Noticias slug={noticiaSlug} />
      ) : entrar ? (
        <Backoffice />
      ) : slugCurso ? (
        <SiteCurso slug={slugCurso} />
      ) : catalogo ? (
        <SiteCatalog />
      ) : (
        <SiteLanding />
      )}
    </Suspense>
  </StrictMode>,
);
