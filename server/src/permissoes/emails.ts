import { COM_FORMADOR, EQUIPA_E_CONTABILIDADE, type Perfil, type Regra } from "./perfis.js";

/** Histórico dos envios (dados pessoais) e filas: as coordenações e a contabilidade, cada uma só da sua área. */
const HISTORICO: Perfil[] = ["admin", "secretaria", "financiada", "contabilidade"];

/**
 * Emails automáticos e eventos, por área (Gold, Financiada, Contabilidade): cada perfil só vê e edita os modelos,
 * as regras e o histórico da sua área (as rotas filtram por `areasDoPerfil`); a administração vê todos.
 */
export const regras: Regra[] = [
  ["GET", "/v1/email/opcoes", EQUIPA_E_CONTABILIDADE],
  ["*", "/v1/email/templates*", EQUIPA_E_CONTABILIDADE],
  ["POST", "/v1/email/previsualizar", EQUIPA_E_CONTABILIDADE],
  ["*", "/v1/email/rules*", EQUIPA_E_CONTABILIDADE],
  ["*", "/v1/email/regras*", EQUIPA_E_CONTABILIDADE],
  ["GET", "/v1/email/*", HISTORICO],
  ["*", "/v1/email/*", HISTORICO],
  ["POST", "/v1/events", COM_FORMADOR],
];
