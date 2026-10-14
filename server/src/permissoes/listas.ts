import { PEDAGOGIA, type Regra } from "./perfis.js";

/** Listas de opções. Acrescentar segue a regra por omissão; renomear e apagar mexem em muitos registos. */
export const regras: Regra[] = [
  ["POST", "/v1/listas/:lista/:id/renomear", PEDAGOGIA],
  ["DELETE", "/v1/listas/:lista/:id", PEDAGOGIA],
];
