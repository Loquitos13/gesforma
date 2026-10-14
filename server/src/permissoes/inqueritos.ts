import { EQUIPA, type Regra } from "./perfis.js";

/** Inquéritos: lista e resultados para a equipa (o formador nunca lê; ver FORMADOR_SEM_LEITURA). */
export const regras: Regra[] = [
  ["GET", "/v1/inqueritos", EQUIPA],
  ["GET", "/v1/inqueritos/:id/resultados", EQUIPA],
];
