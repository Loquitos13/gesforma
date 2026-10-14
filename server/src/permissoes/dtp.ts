import { EQUIPA, type Regra } from "./perfis.js";

/** Dossiê técnico-pedagógico (vista geral). Escritas: regra por omissão de permissoes.ts. */
export const regras: Regra[] = [
  ["GET", "/v1/dtp/:regime/resumo", EQUIPA],
];
