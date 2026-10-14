import { MARKETING, type Regra } from "./perfis.js";

/** Campanhas comerciais. */
export const regras: Regra[] = [
  ["*", "/v1/campanhas*", MARKETING],
];
