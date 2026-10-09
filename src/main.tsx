import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthGate } from "./AuthGate";
import { CatalogsProvider } from "./CatalogsContext";
import { DriveProvider } from "./DriveContext";
import { FormadoresProvider } from "./FormadoresContext";
import { NotificacoesProvider } from "./NotificacoesContext";
import { PublicInquerito } from "./PublicInquerito";
import { PublicPreinscricao } from "./PublicPreinscricao";
import { PublicDocumentos } from "./PublicDocumentos";
import { PublicCronograma } from "./PublicCronograma";
import { SiteCatalog } from "./SiteCatalog";
import { SiteCurso } from "./SiteCurso";
import { SiteLanding } from "./SiteLanding";
import { ToastHost } from "./ToastHost";
import { TurmasProvider } from "./TurmasContext";
import "./index.css";

const path = window.location.pathname.replace(/\/+$/, "") || "/";
const entrar = path === "/entrar";
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
