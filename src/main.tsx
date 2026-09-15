import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AuthGate } from "./AuthGate";
import { FormadoresProvider } from "./FormadoresContext";
import { TurmasProvider } from "./TurmasContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AuthGate>
      <TurmasProvider>
        <FormadoresProvider>
          <App />
        </FormadoresProvider>
      </TurmasProvider>
    </AuthGate>
  </StrictMode>,
);
