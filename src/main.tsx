import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./gesforma/App";
import { AuthGate } from "./partilhado/AuthGate";
import { CatalogsProvider } from "./partilhado/CatalogsContext";
import { DriveProvider } from "./partilhado/DriveContext";
import { FormadoresProvider } from "./partilhado/FormadoresContext";
import { NotificacoesProvider } from "./gesforma/NotificacoesContext";
import { PublicInquerito } from "./site/PublicInquerito";
import { PublicPreinscricao } from "./site/PublicPreinscricao";
import { PublicDocumentos } from "./site/PublicDocumentos";
import { PublicCronograma } from "./site/PublicCronograma";
import { SiteCatalog } from "./site/SiteCatalog";
import { SiteCurso } from "./site/SiteCurso";
import { AreaFormando } from "./site/AreaFormando";
import { Noticias } from "./site/Noticias";
import { SiteLanding } from "./site/SiteLanding";
import { ToastHost } from "./gesforma/ToastHost";
import { TurmasProvider } from "./partilhado/TurmasContext";
import "./index.css";

const path = window.location.pathname.replace(/\/+$/, "") || "/";
const entrar = path === "/entrar" || path.startsWith("/gesforma");
const areaFormando = path === "/area-formando" || path.startsWith("/area-formando/");
const noticiaSlug = path.startsWith("/noticias/") ? decodeURIComponent(path.slice("/noticias/".length).split("/")[0] ?? "") : "";
const noticias = path === "/noticias";
const catalogo = path === "/formacao";
const slugCurso = path.startsWith("/formacao/") ? decodeURIComponent(path.slice("/formacao/".length).split("/")[0] ?? "") : "";
const publicForm = path === "/pre-inscricao";
const docsToken = path.startsWith("/documentos/") ? decodeURIComponent(path.slice("/documentos/".length).split("/")[0] ?? "") : "";
const cronogramaMatch = path.match(/^\/cronograma\/(gold|fin)\/(\d+)$/);
const inqToken = path.startsWith("/inquerito/") ? decodeURIComponent(path.slice("/inquerito/".length).split("/")[0] ?? "") : "";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {publicForm ? (
      <PublicPreinscricao />
    ) : cronogramaMatch ? (
      <PublicCronograma regime={cronogramaMatch[1] as "gold" | "fin"} turmaId={Number(cronogramaMatch[2])} />
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
        <TurmasProvider>
          <FormadoresProvider>
            <CatalogsProvider>
              <DriveProvider>
                <NotificacoesProvider>
                  <App />
                  <ToastHost />
                </NotificacoesProvider>
              </DriveProvider>
            </CatalogsProvider>
          </FormadoresProvider>
        </TurmasProvider>
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
