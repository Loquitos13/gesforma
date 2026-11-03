import { COORDENACAO, type Regra } from "./perfis.js";

/** Configurações: o resumo do estado lê-o a secretaria; cada secção tem as suas regras (sistema.ts). */
export const regras: Regra[] = [
  ["POST", "/v1/configuracoes/logo", COORDENACAO],
  ["DELETE", "/v1/configuracoes/logo", COORDENACAO],
  ["POST", "/v1/configuracoes/logo-dgert", COORDENACAO],
  ["DELETE", "/v1/configuracoes/logo-dgert", COORDENACAO],
  ["GET", "/v1/configuracoes/*", COORDENACAO],
];
