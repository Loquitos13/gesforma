import { FIN, type Regra } from "./perfis.js";

/** Despesas da Financiada. */
export const regras: Regra[] = [
  ["*", "/v1/despesas*", FIN],
];
