import { ADMIN, type Perfil, type Regra } from "./perfis.js";

/**
 * Painéis: as coordenações não os veem (pedido do cliente); o Gold fica com a administração e o comercial,
 * o da Financiada com a administração.
 */
export const regras: Regra[] = [
  ["GET", "/v1/painel/gold", ["admin", "comercial"] as Perfil[]],
  ["GET", "/v1/painel/fin", ADMIN],
];
