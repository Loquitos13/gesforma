// API da equipa comercial (Gold) e da Financiada.
import type { Proposta } from "./crmDiretorio";
import { api, enviar, qs } from "./cliente";

export type RegimeEquipa = "gold" | "fin";
export type Indicadores = { leads: number; pagos: number; receita: number; propostas: number; aceites: number; conversao: number };
export type Carteira = {
  leads: number; porContactar: number; emConversa: number; pagamentoPedido: number; pagos: number; formandos: number;
  receita: number; conversao: number; maisAntigoPorContactar: string | null;
  propostas: number; propostasAbertas: number; aceites: number; recusadas: number; pipeline: number; sucessoPropostas: number;
};
export type Membro = {
  id: string; nome: string; email: string; ativo: boolean; ultimoAcesso: string | null; telefone: string; nota: string;
  objetivo: { conversao: number | null; leads: number; propostas: number };
  carteira: Carteira; atual: Indicadores; anterior: Indicadores;
};
export type PeriodoEquipa = { de: string; ate: string; dias: number; anterior: { de: string; ate: string } };
export type LeadMembro = { id: number; nome: string; apelido: string; email: string; telf: string; curso: string; estado: string; notas: string; preco: number };
export type NotaMembro = { id: number; preinscricaoId: number; leadNome: string; leadCurso: string; nota: string; criadaEm: string | null };
export type ASeguir = { tipo: "proposta" | "pagamento"; id: number; titulo: string; detalhe: string };

type Sinal = { signal?: AbortSignal };
type Periodo = { de?: string; ate?: string };

export const apiEquipa = (regime: RegimeEquipa, p: Periodo, o: Sinal = {}) =>
  api<{
    periodo: PeriodoEquipa;
    totais: { membros: number; ativos: number; carteira: number; porContactar: number; pipeline: number; atual: Omit<Indicadores, "aceites" | "conversao">; anterior: Omit<Indicadores, "aceites" | "conversao"> };
    membros: Membro[];
  }>(`/v1/equipa${qs({ regime, ...p })}`, { silencioso: true, signal: o.signal });

export const apiMembro = (id: string, regime: RegimeEquipa, p: Periodo, o: Sinal = {}) =>
  api<{ periodo: PeriodoEquipa; membro: Membro; leads: LeadMembro[]; notas: NotaMembro[]; seguir: ASeguir[] }>(
    `/v1/equipa/${id}${qs({ regime, ...p })}`, { silencioso: true, signal: o.signal },
  );

export const apiPrecoInscricao = (curso: string, local?: string, horario?: string) =>
  api<{ preco: number }>(`/v1/equipa/preco${qs({ curso, local, horario })}`, { silencioso: true });

export const apiNovaPropostaMembro = (id: string, d: {
  clienteNome: string; clienteEmail?: string; curso?: string; valor?: number; estado?: string; respostaCliente?: string;
  notas?: string; preinscricaoId?: number | null; regime: RegimeEquipa; corpo?: string; templateId?: number | null; clienteId?: number | null;
}) => enviar.post<{ proposta: Proposta }>(`/v1/equipa/${id}/propostas`, d);

export const apiNotaMembro = (id: string, d: { preinscricaoId: number; nota: string }) => enviar.post<{ ok: true }>(`/v1/equipa/${id}/notas`, d);
export const apiObjetivoMembro = (id: string, d: { metaPct?: number; metaLeads?: number; metaPropostas?: number }) =>
  enviar.put<{ ok: true }>(`/v1/equipa/${id}/objetivo`, d);
export const apiPerfilMembro = (id: string, d: { name?: string; telefone?: string; nota?: string }) =>
  enviar.patch<{ ok: true }>(`/v1/equipa/${id}/perfil`, d);
