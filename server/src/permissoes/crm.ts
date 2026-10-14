import { SECRETARIA, PEDAGOGIA, type Regra } from "./perfis.js";

/** CRM: documentos, validação, pagamento pedido e remoção de leads. O formador não entra em `/v1/crm*`. */
export const regras: Regra[] = [
  ["DELETE", "/v1/preinscricoes/:id", PEDAGOGIA],
  ["POST", "/v1/crm/leads/:id/documentos/:docId/validar", PEDAGOGIA],
  ["POST", "/v1/crm/leads/:id/documentos/:docId/recusar", PEDAGOGIA],
  ["POST", "/v1/crm/leads/:id/validar-preinscricao", PEDAGOGIA],
  ["POST", "/v1/crm/leads/:id/pedir-pagamento", PEDAGOGIA],
  ["POST", "/v1/crm/leads/:id/turma-cheia", PEDAGOGIA],
  ["DELETE", "/v1/crm/etiquetas/:id", SECRETARIA],
  ["DELETE", "/v1/crm/clientes/:id", SECRETARIA],
  ["DELETE", "/v1/crm/parceiros/:id", SECRETARIA],
  ["DELETE", "/v1/crm/contratos/:id", SECRETARIA],
  ["POST", "/v1/crm/modelos/*", SECRETARIA],
  ["PATCH", "/v1/crm/modelos/*", SECRETARIA],
  ["DELETE", "/v1/crm/modelos/*", SECRETARIA],
];
