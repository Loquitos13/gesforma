import { EQUIPA, PEDAGOGIA, type Regra } from "./perfis.js";

/** Turmas: o formador não altera a turma (só escreve sumários, presenças e planos das suas sessões; ver pedagogia.ts). */
export const regras: Regra[] = [
  ["PATCH", "/v1/turmas-gold/:id", EQUIPA],
  ["PATCH", "/v1/turmas-fin/:id", PEDAGOGIA],
  ["*", "/v1/turmas-fin*", PEDAGOGIA],
  ["*", "/v1/formandos-fin*", PEDAGOGIA],
];
