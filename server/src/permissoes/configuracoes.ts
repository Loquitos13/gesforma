import { ADMIN, SECRETARIA, type Regra } from "./perfis.js";

/** Configurações: o resumo do estado lê-o a secretaria; cada secção tem as suas regras (sistema.ts). */
export const regras: Regra[] = [
  ["POST", "/v1/configuracoes/logo", ADMIN],
  ["DELETE", "/v1/configuracoes/logo", ADMIN],
  ["POST", "/v1/configuracoes/logo-dgert", ADMIN],
  ["DELETE", "/v1/configuracoes/logo-dgert", ADMIN],
  ["GET", "/v1/configuracoes/*", SECRETARIA],
];
