// API dos cronogramas para vender: GET /v1/cronogramas/gold (server/src/rotas/cronogramas.ts). Só leitura.
import { api } from "./cliente";

export type SessaoCronogramaVenda = {
  data: string;
  horaInicio: string;
  horaFim: string;
  modalidade: string;
  modulos: string[];
  formadores: string[];
};

export type CronogramaVenda = {
  turmaId: number;
  nome: string;
  curso: string;
  local: string;
  horario: string;
  dataInicio: string;
  dataFim: string;
  fase: "por_comecar" | "a_decorrer";
  vagasLivres: number;
  vagasMostradas: number;
  preco: number | null;
  publicadoEm: string | null;
  ligacaoPublica: string | null;
  sessoes: SessaoCronogramaVenda[];
};

export function apiCronogramasGold(signal?: AbortSignal) {
  return api<{ turmas: CronogramaVenda[]; hoje: string }>("/v1/cronogramas/gold", { signal });
}
