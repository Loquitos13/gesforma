import { ADMIN, COORDENACAO, EQUIPA, SECRETARIA, EQUIPA_E_CONTABILIDADE, TODA_A_EQUIPA, type Regra } from "./perfis.js";

/** Integrações, utilizadores e configuração do sistema. */
export const regras: Regra[] = [
  ["*", "/v1/drive/config", ADMIN],
  ["*", "/v1/drive/disconnect", ADMIN],
  ["GET", "/v1/drive/oauth/start", ADMIN],
  ["DELETE", "/v1/drive/files/:id", SECRETARIA],
  ["*", "/v1/crm/whatsapp/config", ADMIN],
  ["*", "/v1/crm/whatsapp/desligar", ADMIN],
  ["*", "/v1/crm/whatsapp/simular", ADMIN],
  // Caixa de conversas do WhatsApp: a equipa (comercial e coordenações) lê e responde.
  ["GET", "/v1/crm/whatsapp/conversa", EQUIPA],
  // Eliminar de vez: só a administração e as coordenações.
  ["DELETE", "/v1/crm/whatsapp/conversa", COORDENACAO],
  ["GET", "/v1/crm/whatsapp/conversas", EQUIPA],
  ["POST", "/v1/crm/whatsapp/responder", EQUIPA],
  ["POST", "/v1/crm/whatsapp/devolver", EQUIPA],
  ["POST", "/v1/crm/whatsapp/assumir", EQUIPA],
  ["POST", "/v1/crm/whatsapp/fechar", EQUIPA],
  ["*", "/v1/auth/microsoft/config", ADMIN],
  ["*", "/v1/auth/microsoft/disconnect", ADMIN],
  ["*", "/v1/settings/smtp*", ADMIN],
  ["PUT", "/v1/settings/:id", COORDENACAO],
  ["GET", "/v1/settings", EQUIPA_E_CONTABILIDADE],
  ["POST", "/v1/site/hero/:slot/imagem", COORDENACAO],
  // A contabilidade abre os comprovativos, recibos e faturas (o handler só lhe mostra esses ficheiros).
  ["GET", "/v1/drive/files/:id/content", TODA_A_EQUIPA],
  ["*", "/v1/sistema/*", ADMIN],
];
