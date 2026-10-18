import { ADMIN, type Regra } from "./perfis.js";

/** Conteúdo do site. Os testemunhos (revisão) e os serviços para empresas são da administração (como a edição do site). */
export const regras: Regra[] = [
  ["*", "/v1/testemunhos*", ADMIN],
  ["*", "/v1/servicos*", ADMIN],
];
