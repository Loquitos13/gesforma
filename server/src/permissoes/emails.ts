import { SECRETARIA, COM_FORMADOR, type Regra } from "./perfis.js";

/** Emails automáticos e eventos. */
export const regras: Regra[] = [
  ["GET", "/v1/email/*", SECRETARIA],
  ["*", "/v1/email/*", SECRETARIA],
  ["POST", "/v1/events", COM_FORMADOR],
];
