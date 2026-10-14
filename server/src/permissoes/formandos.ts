import { FIN, GOLD, PEDAGOGIA, SECRETARIA, type Regra } from "./perfis.js";

/**
 * Formandos: cada regime só para a sua equipa. Apagar uma ficha é da secretaria (Gold)
 * ou da pedagogia (Financiada). O formador fica de fora pelas regras por omissão.
 */
export const regras: Regra[] = [
  ["DELETE", "/v1/formandos-gold/:id", SECRETARIA],
  ["DELETE", "/v1/formandos-fin/:id", PEDAGOGIA],
  ["DELETE", "/v1/inscricoes-fin/:id", PEDAGOGIA],
  ["*", "/v1/formandos-gold*", GOLD],
  ["*", "/v1/formandos-fin*", FIN],
  ["*", "/v1/formandos/gold/*", GOLD],
  ["*", "/v1/formandos/fin/*", FIN],
  ["*", "/v1/inscricoes-fin*", FIN],
  // Apoios da Financiada (regras, processamento, pagamento): só a equipa da Financiada.
  ["*", "/v1/apoios*", FIN],
];
