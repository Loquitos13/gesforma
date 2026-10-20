import { MARKETING, SECRETARIA, type Regra } from "./perfis.js";

/** Campanhas comerciais. Apagar é só da gestão (o comercial cria e altera). */
export const regras: Regra[] = [
  ["DELETE", "/v1/campanhas/:id", SECRETARIA],
  ["*", "/v1/campanhas*", MARKETING],
];
