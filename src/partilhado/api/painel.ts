// API do domínio "painel": GET /v1/painel/:regime (server/src/rotas/painel.ts).
import { api, qs } from "./cliente";

export type RegimePainel = "gold" | "fin";
export type EixoPainel = "curso" | "local" | "horario";

export type IndicadorPainel = {
  id: string;
  rotulo: string;
  valor: number | null;
  /** Valor no período anterior equivalente; null quando o indicador é um estado actual. */
  anterior: number | null;
  formato: "num" | "eur" | "pct";
  pp?: boolean;
  inverso?: boolean;
  nota?: string;
  tom?: "perigo" | "aviso" | "neutro";
};

export type MesPainel = {
  chave: string;
  valor: number;
  stats: { id: string; valor: number }[];
  porCurso: { nome: string; valor: number }[];
  conheceu: { rotulo: string; n: number }[];
};

export type EtapaFunil = { id: string; rotulo: string; n: number };

export type TarefaPainel = { id: string; n: number; detalhe: string; leadId?: number | null };

export type TurmaProxima = {
  id: number; nome: string; curso: string; local: string; inicio: string;
  capacidade: number; ocupadas: number; reservas: number; docsCompletos: number | null;
};

export type TurmaEmCurso = {
  id: number; nome: string; curso: string; ufcd: string; local: string; financiador: string;
  formandos: number; horasDadas: number; horasPrevistas: number;
  assiduidade: number | null; abaixoMinimo: number; docsCompletos: number;
  sessoesPorAssinar: number; dtpPct: number; dtpBloqueantes: number;
};

export type Painel = {
  regime: RegimePainel;
  periodo: { de: string; ate: string; anterior: { de: string; ate: string } };
  kpis: IndicadorPainel[];
  serie: MesPainel[];
  funil: { principal: EtapaFunil[]; prePagos: EtapaFunil[] | null };
  conheceu: { rotulo: string; n: number; convertidas: number }[];
  proximasTurmas: TurmaProxima[];
  desagregacao: { eixo: EixoPainel; linhas: { chave: string; pre: number; formandos: number; receita: number }[] };
  aTratar: TarefaPainel[];
  metodos: { metodo: string; valor: number; n: number }[] | null;
  porReceber: { valor: number; n: number } | null;
  ticketMedio?: number;
  turmasEmCurso: TurmaEmCurso[] | null;
  assiduidadeMinima: number | null;
};

export type FiltroPainel = {
  de?: string; ate?: string; curso?: string; local?: string; horario?: string; financiador?: string; eixo?: EixoPainel;
};

export function apiPainel(regime: RegimePainel, filtro: FiltroPainel, signal?: AbortSignal) {
  return api<Painel>(`/v1/painel/${regime}${qs(filtro)}`, { signal });
}
