import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthGate } from "./AuthGate";
import { CatalogsProvider } from "./CatalogsContext";
import { DriveProvider } from "./DriveContext";
import { FormadoresProvider } from "./FormadoresContext";
import { NotificacoesProvider } from "./NotificacoesContext";
import { PublicPreinscricao } from "./PublicPreinscricao";
import { TurmasProvider } from "./TurmasContext";
import "./index.css";

const publicForm = window.location.pathname.replace(/\/+$/, "") === "/pre-inscricao";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {publicForm ? (
      <PublicPreinscricao />
    ) : (
      <AuthGate>
        <TurmasProvider>
          <FormadoresProvider>
            <CatalogsProvider>
              <DriveProvider>
                <NotificacoesProvider>
                  <App />
                </NotificacoesProvider>
              </DriveProvider>
            </CatalogsProvider>
          </FormadoresProvider>
        </TurmasProvider>
      </AuthGate>
    )}
  </StrictMode>,
);
