import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthGate } from "./AuthGate";
import { CatalogsProvider } from "./CatalogsContext";
import { FormadoresProvider } from "./FormadoresContext";
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
              <App />
            </CatalogsProvider>
          </FormadoresProvider>
        </TurmasProvider>
      </AuthGate>
    )}
  </StrictMode>,
);
