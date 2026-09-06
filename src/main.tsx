import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { TurmasProvider } from "./TurmasContext";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TurmasProvider>
      <App />
    </TurmasProvider>
  </StrictMode>,
);
