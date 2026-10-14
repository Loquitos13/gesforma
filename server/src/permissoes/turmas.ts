import { PEDAGOGIA, COM_FORMADOR, PEDAGOGIA_E_FORMADOR, type Regra } from "./perfis.js";

/** Turmas: o formador só marca início/fim das suas sessões (verificado no handler). */
export const regras: Regra[] = [
  ["PATCH", "/v1/turmas-gold/:id", COM_FORMADOR],
  ["PATCH", "/v1/turmas-fin/:id", PEDAGOGIA_E_FORMADOR],
  ["*", "/v1/turmas-fin*", PEDAGOGIA],
  ["*", "/v1/formandos-fin*", PEDAGOGIA],
];
