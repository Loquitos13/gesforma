import type { Destino, Separador, Vista } from "../rotasGesforma";

/** Parâmetros da vista actual (vêm do URL e da navegação). */
export type ParamsVista = Omit<Destino, "view" | "tab" | "filtros"> & { tab: Separador; drive?: string };

/** Destino de navegação: uma vista, ou uma vista com parâmetros. */
export type Navegar = (destino: Vista | Destino) => void;

/**
 * Props que todas as vistas recebem do router (`shell/rotas.tsx`).
 * Cada vista vive em `vistas/<area>/<Nome>.tsx` e exporta-se por omissão.
 */
export type VistaProps = {
  view: Vista;
  params: ParamsVista;
  navigate: Navegar;
  /** Esquece um parâmetro já usado (ex.: a ficha aberta a partir da pesquisa). */
  limpar: (chave: "formandoId" | "formadorId" | "leadId") => void;
};
