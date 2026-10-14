import { ADMIN, type Regra } from "./perfis.js";

/** Gestão de utilizadores e sessões: só a administração. */
export const regras: Regra[] = [
  ["*", "/v1/utilizadores*", ADMIN],
];
