import { CONTABILIDADE, PAGAMENTOS, type Regra } from "./perfis.js";

/**
 * Financeiro. A contabilidade valida o comprovativo (confirmar ou recusar) e só então a pré-inscrição fica concluída;
 * a fatura pode ser emitida depois. A coordenação Gold vê os pagamentos (comprovativos, faturação, recibos e faturas).
 */
export const regras: Regra[] = [
  ["POST", "/v1/pagamentos/:id/confirmar", CONTABILIDADE],
  ["POST", "/v1/pagamentos/:id/recusar", CONTABILIDADE],
  ["POST", "/v1/pagamentos", CONTABILIDADE],
  ["PATCH", "/v1/pagamentos/:id", CONTABILIDADE],
  ["DELETE", "/v1/pagamentos/:id", CONTABILIDADE],
  // A fatura (PDF) anexa-a e envia-a a contabilidade; a coordenação Gold vê-a.
  ["POST", "/v1/pagamentos/:id/fatura", CONTABILIDADE],
  ["POST", "/v1/pagamentos/:id/fatura/enviar", CONTABILIDADE],
  ["*", "/v1/pagamentos*", PAGAMENTOS],
];
