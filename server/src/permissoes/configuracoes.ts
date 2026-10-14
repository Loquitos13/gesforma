import { SECRETARIA, type Regra } from "./perfis.js";

/** Configurações: o resumo do estado lê-o a secretaria; cada secção tem as suas regras (sistema.ts). */
export const regras: Regra[] = [
  ["GET", "/v1/configuracoes/*", SECRETARIA],
];
