import { PAGAMENTOS, SECRETARIA, type Regra } from "./perfis.js";

/**
 * Financeiro. A contabilidade vê tudo dos pagamentos (comprovativos, dados de faturação, recibos e faturas).
 * TODO (cliente): confirmar e recusar (que concluem ou travam a inscrição) e o registo manual ficam com a
 * coordenação Gold até o cliente decidir se a validação da contabilidade também conclui a inscrição.
 */
export const regras: Regra[] = [
  ["POST", "/v1/pagamentos/:id/confirmar", SECRETARIA],
  ["POST", "/v1/pagamentos/:id/recusar", SECRETARIA],
  ["POST", "/v1/pagamentos", SECRETARIA],
  ["PATCH", "/v1/pagamentos/:id", SECRETARIA],
  ["DELETE", "/v1/pagamentos/:id", SECRETARIA],
  ["*", "/v1/pagamentos*", PAGAMENTOS],
];
