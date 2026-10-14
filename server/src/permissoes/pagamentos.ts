import { SECRETARIA, type Regra } from "./perfis.js";

/** Financeiro. */
export const regras: Regra[] = [
  ["*", "/v1/pagamentos*", SECRETARIA],
];
