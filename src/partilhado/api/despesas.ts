// API das despesas da Financiada (template de despesas).
import type { DadosDespesa } from "../despesas";
import { api, enviar } from "./cliente";
import { descarregar } from "./ficheiros";

export type Despesa = { id: number; ordem: number; dados: DadosDespesa; atualizadoEm: string };

export const apiDespesas = (o: { signal?: AbortSignal } = {}) => api<{ despesas: Despesa[] }>("/v1/despesas", { signal: o.signal });
export const apiCriarDespesa = (dados: DadosDespesa) => enviar.post<{ despesa: Despesa }>("/v1/despesas", { dados });
export const apiAlterarDespesa = (id: number, dados: DadosDespesa) => enviar.patch<{ despesa: Despesa }>(`/v1/despesas/${id}`, { dados });
export const apiApagarDespesa = (id: number) => enviar.delete<{ ok: boolean }>(`/v1/despesas/${id}`);
export const apiExportarDespesas = () => descarregar("/v1/despesas/exportar", "despesas.xlsx");
