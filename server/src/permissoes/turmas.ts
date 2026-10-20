import { EQUIPA, GOLD, PEDAGOGIA, type Regra } from "./perfis.js";

/** Turmas: o formador não altera a turma (só escreve sumários, presenças e planos das suas sessões; ver pedagogia.ts). */
export const regras: Regra[] = [
  // Cronogramas das turmas Gold para vender (só leitura): a equipa Gold; o formador não.
  ["GET", "/v1/cronogramas/gold", GOLD],
  ["PATCH", "/v1/turmas-gold/:id", EQUIPA],
  ["PATCH", "/v1/turmas-fin/:id", PEDAGOGIA],
  ["*", "/v1/turmas-fin*", PEDAGOGIA],
  ["*", "/v1/formandos-fin*", PEDAGOGIA],
];
