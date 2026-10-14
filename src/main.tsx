import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./gesforma/App";
import { AuthGate } from "./partilhado/AuthGate";
import { DriveProvider } from "./partilhado/DriveContext";
import { NotificacoesProvider } from "./gesforma/NotificacoesContext";
import { PublicInquerito } from "./site/PublicInquerito";
import { PublicPreinscricao } from "./site/PublicPreinscricao";
import { PublicDocumentos } from "./site/PublicDocumentos";
import { PublicFormandoDocumentos } from "./site/PublicFormandoDocumentos";
import { PublicCronograma } from "./site/PublicCronograma";
import { SiteCatalog } from "./site/SiteCatalog";
import { SiteCurso } from "./site/SiteCurso";
import { AreaFormando } from "./site/AreaFormandoPainel";
import { Noticias } from "./site/Noticias";
import { SiteLanding } from "./site/SiteLandingRodape";
import { ToastHost } from "./gesforma/ToastHost";
import "./index.css";

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
const inqToken = path.startsWith("/inquerito/") ? decodeURIComponent(path.slice("/inquerito/".length).split("/")[0] ?? "") : "";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {publicForm ? (
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
      <AuthGate>
        <DriveProvider>
          <NotificacoesProvider>
            <App />
            <ToastHost />
          </NotificacoesProvider>
        </DriveProvider>
      </AuthGate>
    ) : slugCurso ? (
      <SiteCurso slug={slugCurso} />
    ) : catalogo ? (
      <SiteCatalog />
    ) : (
      <SiteLanding />
    )}
  </StrictMode>,
);
