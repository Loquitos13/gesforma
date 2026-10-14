import { SECRETARIA, PEDAGOGIA, MARKETING, type Regra } from "./perfis.js";

/** Oferta, regras de abertura de turmas e modelos de dossiê. */
export const regras: Regra[] = [
  ["POST", "/v1/cursos-gold", MARKETING],
  ["PATCH", "/v1/cursos-gold/:id", MARKETING],
  ["DELETE", "/v1/cursos-gold/:id", SECRETARIA],
  ["*", "/v1/cursos-fin*", PEDAGOGIA],
  ["*", "/v1/turma-regras*", PEDAGOGIA],
  ["POST", "/v1/turmas/auto-regras", PEDAGOGIA],
  ["PUT", "/v1/cursos/:regime/:id/dtp-modelo", PEDAGOGIA],
  ["*", "/v1/dtp/gold/entidades*", PEDAGOGIA],
];
