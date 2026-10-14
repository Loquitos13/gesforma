import { ADMIN, type Regra } from "./perfis.js";

/** Registo de auditoria: só a administração o lê. */
export const regras: Regra[] = [
  ["*", "/v1/auditoria*", ADMIN],
];
