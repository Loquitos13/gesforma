import { PEDAGOGIA, PEDAGOGIA_E_FORMADOR, type Regra } from "./perfis.js";

/** Formadores: criar e apagar cria/encerra contas de acesso. */
export const regras: Regra[] = [
  ["POST", "/v1/formadores", PEDAGOGIA],
  ["DELETE", "/v1/formadores/:id", PEDAGOGIA],
  ["POST", "/v1/formadores/:id/acesso", PEDAGOGIA],
  ["PATCH", "/v1/formadores/:id", PEDAGOGIA_E_FORMADOR],
  ["PUT", "/v1/formadores/:id/docs", PEDAGOGIA_E_FORMADOR],
];
