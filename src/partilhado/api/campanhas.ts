// API das campanhas comerciais. Os números vêm do servidor (pré-inscrições ligadas pela campanha).
import { api, enviar, qs } from "./cliente";

export type Campanha = {
  id: number; nome: string; data: string; fim: string; encarregado: string; curso: string; canal: string; notas: string;
  custo: number; ativa: boolean; preinscricoes: number; pagos: number; receita: number; porContactar: number; desistiram: number;
  formandos: number; receitaEstimada: number; conversao: number; ticketMedio: number; roi: number | null;
};
export type CampanhaFicha = Campanha & { origens: { origem: string; n: number }[] };
export type ResumoCampanhas = {
  total: number; ativas: number; preinscricoes: number; porContactar: number; pagos: number; receita: number; custo: number; roi: number | null;
};
export type DadosCampanha = { nome: string; data: string; fim: string; encarregado: string; curso: string; canal: string; custo: number; notas: string };
export type FiltroCampanhas = { estado?: string; canal?: string; curso?: string; responsavel?: string; q?: string };

export const apiCampanhas = (f: FiltroCampanhas, o: { signal?: AbortSignal } = {}) =>
  api<{ campanhas: Campanha[]; resumo: ResumoCampanhas }>(`/v1/campanhas${qs(f)}`, { silencioso: true, signal: o.signal });
export const apiCampanha = (id: number, o: { signal?: AbortSignal } = {}) =>
  api<{ campanha: CampanhaFicha }>(`/v1/campanhas/${id}`, { silencioso: true, signal: o.signal });
export const apiCriarCampanha = (d: DadosCampanha) => enviar.post<{ campanha: CampanhaFicha }>("/v1/campanhas", d);
export const apiAlterarCampanha = (id: number, d: Partial<DadosCampanha>) => enviar.patch<{ campanha: CampanhaFicha }>(`/v1/campanhas/${id}`, d);
export const apiApagarCampanha = (id: number) => enviar.delete<{ ok: true }>(`/v1/campanhas/${id}`);
