import { FIN, GOLD, type Regra } from "./perfis.js";

/** Painéis: o Gold é de quem trabalha na Gold, o da Financiada de quem trabalha na Financiada. */
export const regras: Regra[] = [
  ["GET", "/v1/painel/gold", GOLD],
  ["GET", "/v1/painel/fin", FIN],
];
