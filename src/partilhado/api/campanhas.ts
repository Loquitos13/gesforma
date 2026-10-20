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
  api<{ campanhas: Campanha[]; resumo: ResumoCampanhas }>(`/v1/campanhas${qs(f)}`, { signal: o.signal });
export const apiCampanha = (id: number, o: { signal?: AbortSignal } = {}) =>
  api<{ campanha: CampanhaFicha }>(`/v1/campanhas/${id}`, { signal: o.signal });
export const apiCriarCampanha = (d: DadosCampanha) => enviar.post<{ campanha: CampanhaFicha }>("/v1/campanhas", d);
export const apiAlterarCampanha = (id: number, d: Partial<DadosCampanha>) => enviar.patch<{ campanha: CampanhaFicha }>(`/v1/campanhas/${id}`, d);
export const apiApagarCampanha = (id: number) => enviar.delete<{ ok: true }>(`/v1/campanhas/${id}`);

// ─── Campanhas por email aos pré-inscritos parados ───────────────────────────
export type CriteriosEmail = { dias: number; contactos: number; curso: string; soDocsEmFalta: boolean };
export type CandidatoEmail = {
  id: number; nome: string; email: string; curso: string; regime: "gold" | "fin"; estado: string; inscritoEm: string;
  contactos: number; ultimoEnvio: string | null; docsEmFalta: string[]; motivo: string;
};
export type EnvioEmail = {
  id: number; campanhaId: number | null; campanha: string; criterios: Partial<CriteriosEmail>; total: number; enviados: number; criadoEm: string; autor: string;
};
export type DestinoEnvio = { preinscricaoId: number; nome: string; curso: string; estado: string; enviado: boolean; erro: string };

export const apiCandidatosEmail = (k: CriteriosEmail, o: { signal?: AbortSignal } = {}) =>
  api<{ candidatos: CandidatoEmail[] }>(`/v1/campanhas/email/candidatos${qs({ dias: k.dias, contactos: k.contactos, curso: k.curso, soDocsEmFalta: k.soDocsEmFalta ? "1" : "" })}`, { signal: o.signal });
export const apiEnviosEmail = (o: { signal?: AbortSignal } = {}) => api<{ envios: EnvioEmail[] }>("/v1/campanhas/email/envios", { signal: o.signal });
export const apiDestinosEnvio = (id: number, o: { signal?: AbortSignal } = {}) =>
  api<{ destinos: DestinoEnvio[] }>(`/v1/campanhas/email/envios/${id}`, { signal: o.signal });
export const apiEnviarCampanhaEmail = (d: { criterios: CriteriosEmail; ids: number[]; campanhaId: number | null }) =>
  enviar.post<{ envioId: number; total: number; postos: number }>("/v1/campanhas/email/enviar", d);
