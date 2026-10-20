// API do domínio "notificacoes" (server/src/rotas/notificacoes.ts).
import { api, enviar } from "./cliente";

export type Notificacao = {
  chave: string;
  tipo: "error" | "warn" | "info";
  titulo: string;
  texto: string;
  view: string;
  turmaId?: number;
  leadId?: number;
  tab?: string;
  lida: boolean;
};

export const apiNotificacoes = () => api<{ notificacoes: Notificacao[]; naoLidas: number }>("/v1/notificacoes");

export const apiMarcarLidas = (chaves: string[]) => enviar.post<{ ok: boolean }>("/v1/notificacoes/lidas", { chaves });
