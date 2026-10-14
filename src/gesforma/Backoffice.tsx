import App from "./App";
import { AuthGate } from "../partilhado/AuthGate";
import { DriveProvider } from "../partilhado/DriveContext";
import { NotificacoesProvider } from "./NotificacoesContext";
import { ToastHost } from "./ToastHost";

/** Entrada do backoffice (/gesforma), carregada à parte do site público. */
export function Backoffice() {
  return (
    <AuthGate>
      <DriveProvider>
        <NotificacoesProvider>
          <App />
          <ToastHost />
        </NotificacoesProvider>
      </DriveProvider>
    </AuthGate>
  );
}
