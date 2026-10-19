// API das despesas da Financiada (template de despesas), dentro de cada turma.
import type { DadosDespesa } from "../despesas";
import { api, enviar } from "./cliente";
import { descarregar } from "./ficheiros";

export type Despesa = { id: number; ordem: number; turmaId: number | null; dados: DadosDespesa; atualizadoEm: string };

/** `turma` = id da turma, ou "sem" para as antigas ainda sem turma. */
export const apiDespesas = (turma: number | "sem", o: { signal?: AbortSignal } = {}) => api<{ despesas: Despesa[] }>(`/v1/despesas?turma=${turma}`, { signal: o.signal });
export const apiCriarDespesa = (turmaId: number, dados: DadosDespesa) => enviar.post<{ despesa: Despesa }>("/v1/despesas", { turmaId, dados });
export const apiAlterarDespesa = (id: number, dados: DadosDespesa) => enviar.patch<{ despesa: Despesa }>(`/v1/despesas/${id}`, { dados });
export const apiAssociarDespesa = (id: number, turmaId: number) => enviar.patch<{ despesa: Despesa }>(`/v1/despesas/${id}`, { turmaId });
export const apiApagarDespesa = (id: number) => enviar.delete<{ ok: boolean }>(`/v1/despesas/${id}`);
export const apiExportarDespesas = (turmaId: number) => descarregar(`/v1/despesas/exportar?turma=${turmaId}`, "despesas.xlsx");
