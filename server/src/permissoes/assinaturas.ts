import { ADMIN, EQUIPA, type Regra } from "./perfis.js";

/**
 * Assinatura de contratos: a equipa envia e acompanha (o handler confirma que o contrato lhe é visível);
 * o certificado do selo é só da administração. O formador não entra.
 */
export const regras: Regra[] = [
  ["*", "/v1/assinaturas/selo*", ADMIN],
  ["*", "/v1/assinaturas*", EQUIPA],
];
