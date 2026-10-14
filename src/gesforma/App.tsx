import { AppShell } from "./shell/AppShell";

/**
 * Backoffice do GesForma. O shell (menu, cabeçalho, pesquisa, notificações e router)
 * vive em `shell/`; cada ecrã vive em `vistas/<area>/` e carrega só quando é aberto.
 */
export default function App() {
  return <AppShell />;
}
