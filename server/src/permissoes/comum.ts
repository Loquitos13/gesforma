import { COM_FORMADOR, TODA_A_EQUIPA, type Regra } from "./perfis.js";

/** Leitura e escrita que o formador faz na sua área. */
export const regras: Regra[] = [
  ["POST", "/v1/notificacoes/lidas", TODA_A_EQUIPA],
  ["GET", "/v1/notificacoes*", TODA_A_EQUIPA],
  ["POST", "/v1/drive/files", COM_FORMADOR],
];
