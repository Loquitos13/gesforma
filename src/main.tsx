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
import { ToastHost } from "./ToastHost";
import { TurmasProvider } from "./TurmasContext";
import "./index.css";

const path = window.location.pathname.replace(/\/+$/, "") || "/";
const publicForm = path === "/pre-inscricao";
const docsToken = path.startsWith("/documentos/") ? decodeURIComponent(path.slice("/documentos/".length).split("/")[0] ?? "") : "";
const inqToken = path.startsWith("/inquerito/") ? decodeURIComponent(path.slice("/inquerito/".length).split("/")[0] ?? "") : "";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {publicForm ? (
      <PublicPreinscricao />
    ) : docsToken ? (
      <PublicDocumentos token={docsToken} />
    ) : inqToken ? (
      <PublicInquerito token={inqToken} />
    ) : (
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
    )}
  </StrictMode>,
);
