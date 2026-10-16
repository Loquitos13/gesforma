import { ADMIN, SECRETARIA, EQUIPA, type Regra } from "./perfis.js";

/** Integrações, utilizadores e configuração do sistema. */
export const regras: Regra[] = [
  ["*", "/v1/drive/config", ADMIN],
  ["*", "/v1/drive/disconnect", ADMIN],
  ["GET", "/v1/drive/oauth/start", ADMIN],
  ["DELETE", "/v1/drive/files/:id", SECRETARIA],
  ["*", "/v1/crm/whatsapp/config", ADMIN],
  ["*", "/v1/crm/whatsapp/desligar", ADMIN],
  ["*", "/v1/auth/microsoft/config", ADMIN],
  ["*", "/v1/auth/microsoft/disconnect", ADMIN],
  ["*", "/v1/settings/smtp*", ADMIN],
  ["*", "/v1/users*", ADMIN],
  ["PUT", "/v1/settings/:id", SECRETARIA],
  ["GET", "/v1/settings", EQUIPA],
  ["POST", "/v1/site/hero/:slot/imagem", ADMIN],
  ["*", "/v1/sistema/*", ADMIN],
];
