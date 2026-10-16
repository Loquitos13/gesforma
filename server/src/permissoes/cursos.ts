import { FIN, GOLD, SECRETARIA, PEDAGOGIA, MARKETING, type Regra } from "./perfis.js";

/** Oferta, regras de abertura de turmas e modelos de dossiê. Cada regime só para a sua equipa. */
export const regras: Regra[] = [
  ["POST", "/v1/cursos-gold", MARKETING],
  ["PATCH", "/v1/cursos-gold/:id", MARKETING],
  ["DELETE", "/v1/cursos-gold/:id", SECRETARIA],
  ["*", "/v1/cursos-fin*", PEDAGOGIA],
  ["*", "/v1/turma-regras*", PEDAGOGIA],
  ["POST", "/v1/turmas/auto-regras", PEDAGOGIA],
  // O formador lê o modelo do dossiê (documentos pedidos na sua ficha e nas sessões).
  ["GET", "/v1/cursos/gold/:id/dtp-modelo", [...GOLD, "formador"]],
  ["GET", "/v1/cursos/fin/:id/dtp-modelo", [...FIN, "formador"]],
  ["PUT", "/v1/cursos/gold/:id/dtp-modelo", SECRETARIA],
  ["PUT", "/v1/cursos/fin/:id/dtp-modelo", PEDAGOGIA],
  // Catálogo, ficha (site, preços), imagens, dossiê do curso e documentos da pré-inscrição.
  ["GET", "/v1/cursos/gold*", GOLD],
  ["GET", "/v1/cursos/fin*", FIN],
  ["*", "/v1/cursos/gold/*", MARKETING],
  ["*", "/v1/cursos/fin/*", PEDAGOGIA],
  // Entidades do dossiê Gold: como as outras escritas do dossiê Gold (pedagogia da Gold = secretaria).
  ["*", "/v1/dtp/gold/entidades*", SECRETARIA],
];
