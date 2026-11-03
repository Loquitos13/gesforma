import { BLOG, type Regra } from "./perfis.js";

/** Blog. */
export const regras: Regra[] = [
  ["*", "/v1/blog*", BLOG],
];
