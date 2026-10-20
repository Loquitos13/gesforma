// API dos ficheiros do reembolso da turma da Financiada (execução física e despesas): um de cada por turma.
import { api, enviar } from "./cliente";
import { descarregar } from "./ficheiros";

export type TipoReembolso = "execucao-fisica" | "despesas";

export type FicheiroReembolso = {
  tipo: TipoReembolso;
  nome: string;
  atualizadoEm: string | null;
  /** Os dados mudaram desde a cópia na Drive (ou ainda não há cópia). */
  desatualizado: boolean;
  drive: { id: string; nome: string; url: string; pasta: string; guardadoEm: "google" | "local" } | null;
};

export type EstadoReembolso = {
  ficheiros: FicheiroReembolso[];
  execucaoFisica: {
    formandos: number;
    porCampo: { campo: string; formandos: number }[];
    porFormando: { id: number; nome: string; falta: string[] }[];
    /** O que falta à turma (área CNAEF e código UFCD do curso). */
    turma: string[];
    semCodigoPostalLocal: boolean;
  };
};

export const apiReembolso = (turmaId: number, o: { signal?: AbortSignal } = {}) =>
  api<EstadoReembolso>(`/v1/turmas-fin/${turmaId}/reembolso`, { signal: o.signal });
export const apiAtualizarReembolso = (turmaId: number, forcar = false) =>
  enviar.post<EstadoReembolso & { erros: Partial<Record<TipoReembolso, string>> }>(`/v1/turmas-fin/${turmaId}/reembolso/atualizar`, { forcar });
export const apiDescarregarReembolso = (turmaId: number, tipo: TipoReembolso) =>
  descarregar(`/v1/turmas-fin/${turmaId}/reembolso/${tipo}`, `${tipo}.xlsx`);
