import { COM_FORMADOR, type Regra } from "./perfis.js";

/** Leitura e escrita que o formador faz na sua área. */
export const regras: Regra[] = [
  ["POST", "/v1/notificacoes/lidas", COM_FORMADOR],
  ["POST", "/v1/drive/files", COM_FORMADOR],
];
