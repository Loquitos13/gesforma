import { ADMIN, type Regra } from "./perfis.js";

/** Conteúdo do site. A revisão dos testemunhos dos formandos é da administração (como a edição do site). */
export const regras: Regra[] = [
  ["*", "/v1/testemunhos*", ADMIN],
];
