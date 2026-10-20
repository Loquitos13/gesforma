// API do domínio "inqueritos": definição (catálogo kind=inqueritos), taxa de resposta, resultados e respostas.
import { api, enviar, qs } from "./cliente";

export type Regime = "gold" | "fin";
export type PublicoInquerito = "formando" | "formador" | "pos" | "empresa";
export type TipoPergunta = "escala" | "multipla" | "simnao" | "texto";
export type Pergunta = { id: number; tipo: TipoPergunta; texto: string; opcoes?: string[] };

/** Um inquérito na lista, com as contagens feitas no servidor. */
export type InqueritoResumo = {
  id: number;
  titulo: string;
  publico: PublicoInquerito;
  estado: string;
  perguntas: number;
  turmas: number;
  destinatarios: number;
  respostas: number;
  taxa: number | null;
  ultimaResposta: string | null;
  ultimoEnvio: string | null;
};

export type ResumoPergunta = {
  id: number;
  tipo: TipoPergunta;
  texto: string;
  n: number;
  media: number | null;
  distribuicao: Record<string, number>;
  pctSim: number | null;
  contagens: Record<string, number>;
  textos: string[];
};

export type ResultadosInquerito = {
  inquerito: { id: number; regime: Regime; titulo: string; publico: PublicoInquerito };
  resumo: { turmas: number; destinatarios: number; respostas: number; taxa: number | null; filtrado: boolean };
  turmas: { turmaId: number | null; turma: string; curso: string; enviados: number; respostas: number; taxa: number | null; enviadoEm: string | null }[];
  perguntas: ResumoPergunta[];
};

/** Definição completa (para editar as perguntas). */
export type InqueritoDefinicao = { id: number; regime: Regime; titulo: string; publico: PublicoInquerito; perguntas: Pergunta[] } & Record<string, unknown>;

export function apiInqueritos(regime: Regime, signal?: AbortSignal) {
  return api<{ inqueritos: InqueritoResumo[] }>(`/v1/inqueritos${qs({ regime })}`, { signal });
}

export function apiResultadosInquerito(id: number, filtro: { turma?: string; curso?: string }, signal?: AbortSignal) {
  return api<ResultadosInquerito>(`/v1/inqueritos/${id}/resultados${qs(filtro)}`, { signal });
}

/** As definições vivem no catálogo (`catalog_items`, kind=inqueritos). */
export function apiDefinicoesInqueritos(regime: Regime, signal?: AbortSignal) {
  return api<{ itens: InqueritoDefinicao[] }>(`/v1/catalogos/inqueritos${qs({ regime })}`, { signal });
}

export const apiCriarInquerito = (regime: Regime, payload: { titulo: string; publico: PublicoInquerito; perguntas: Pergunta[] }) =>
  enviar.post<{ item: { id: number } }>("/v1/catalog/inqueritos", { regime, payload });

export const apiGravarInquerito = (id: number, payload: { titulo: string; publico: PublicoInquerito; perguntas: Pergunta[] }) =>
  enviar.patch<{ item: { id: number } }>(`/v1/catalog/inqueritos/${id}`, { payload });

export const apiApagarInquerito = (id: number) => enviar.delete<{ ok: boolean }>(`/v1/catalog/inqueritos/${id}`);

export const apiLigacaoInquerito = (id: number) => api<{ token: string; url: string }>(`/v1/inqueritos/${id}/publico`);

export const apiLancarResposta = (id: number, corpo: { turma: string; formando: string; respostas: Record<string, unknown> }) =>
  enviar.post<{ ok: boolean }>(`/v1/inqueritos/${id}/respostas`, corpo);

export const apiEnviarInqueritosTurma = (regime: Regime, turmaId: number) =>
  enviar.post<{ ok: boolean; enviados: number; semEmail: number; inqueritos: number }>(`/v1/turmas/${regime}/${turmaId}/inqueritos/enviar`);
