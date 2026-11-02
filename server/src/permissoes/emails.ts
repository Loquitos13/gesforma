import { SECRETARIA, COM_FORMADOR, EQUIPA, type Regra } from "./perfis.js";

/**
 * Emails automáticos e eventos. Os modelos e as regras editam-se por toda a equipa (as duas coordenações e o
 * comercial); o histórico dos envios (dados pessoais) e as filas ficam com a secretaria.
 */
export const regras: Regra[] = [
  ["GET", "/v1/email/opcoes", EQUIPA],
  ["*", "/v1/email/templates*", EQUIPA],
  ["POST", "/v1/email/previsualizar", EQUIPA],
  ["*", "/v1/email/rules*", EQUIPA],
  ["*", "/v1/email/regras*", EQUIPA],
  ["GET", "/v1/email/*", SECRETARIA],
  ["*", "/v1/email/*", SECRETARIA],
  ["POST", "/v1/events", COM_FORMADOR],
];
