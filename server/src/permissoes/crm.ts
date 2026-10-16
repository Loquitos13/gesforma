import type { TabelaCrm } from "../repos/crmVisivel.js";
import { SECRETARIA, PEDAGOGIA, type Regra } from "./perfis.js";

/**
 * Rotas com o id de uma linha comercial no caminho (e tudo o que está por baixo). O preHandler de app.ts
 * confirma que o ator a pode ver (`linhaVisivel`) e responde 404 se não: a regra do RLS, no código.
 */
const COM_LINHA: [RegExp, TabelaCrm][] = [
  [/^\/v1\/crm\/leads\/(\d+)(\/|$)/, "preinscricoes"],
  [/^\/v1\/preinscricoes\/(\d+)(\/|$)/, "preinscricoes"],
  [/^\/v1\/crm\/propostas\/(\d+)(\/|$)/, "propostas_comerciais"],
  [/^\/v1\/equipa\/propostas\/(\d+)(\/|$)/, "propostas_comerciais"],
  [/^\/v1\/crm\/contratos\/(\d+)(\/|$)/, "contratos_comerciais"],
];

export function linhaCrmDoCaminho(path: string): { tabela: TabelaCrm; id: number } | null {
  for (const [re, tabela] of COM_LINHA) {
    const m = re.exec(path);
    if (m) return { tabela, id: Number(m[1]) };
  }
  return null;
}

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
