import { ADMIN, PEDAGOGIA, PEDAGOGIA_E_FORMADOR, type Regra } from "./perfis.js";

/** Pedagogia da turma. */
export const regras: Regra[] = [
  ["PUT", "/v1/turmas/:regime/:id/sessoes/:n", PEDAGOGIA_E_FORMADOR],
  ["*", "/v1/turmas/:regime/:id/sessoes/:n/assinatura/*", PEDAGOGIA_E_FORMADOR],
  ["POST", "/v1/turmas/:regime/:id/planos/importar", PEDAGOGIA],
  ["GET", "/v1/turmas/:regime/:id/planos/origens", PEDAGOGIA],
  ["PUT", "/v1/turmas/:regime/:id/avaliacao", PEDAGOGIA],
  ["PUT", "/v1/turmas/:regime/:id/certificados/:formandoId", PEDAGOGIA],
  ["PUT", "/v1/turmas/:regime/:id/documentos", PEDAGOGIA],
  ["POST", "/v1/turmas/:regime/:id/cronograma/publicar", PEDAGOGIA],
  ["*", "/v1/turmas/:regime/:id/dtp/*", PEDAGOGIA],
  ["POST", "/v1/turmas/:regime/:id/fecho", PEDAGOGIA],
  ["POST", "/v1/turmas/:regime/:id/reabrir", ADMIN],
  ["POST", "/v1/turmas/:regime/:id/inqueritos/enviar", PEDAGOGIA],
  ["POST", "/v1/inqueritos/:id/respostas", PEDAGOGIA],
];
