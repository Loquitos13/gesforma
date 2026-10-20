// API do domínio "turmas": lista com ocupação e alertas, criar/alterar/apagar e regras de abertura automática.
import { api, enviar, qs, type Pagina } from "./cliente";
import type { SessaoCronograma } from "../turmaModel";

export type Regime = "gold" | "fin";
export type FaseTurma = "abrir" | "decorrer" | "por_fechar" | "fechada" | "cancelada";

export type LinhaTurma = {
  id: number;
  nome: string;
  curso: string;
  cursoId: number | null;
  local: string;
  horario: string;
  dataInicio: string;
  dataFim: string;
  horas: number;
  formador: string;
  formadores: string[];
  estado: string;
  fase: FaseTurma;
  inscricoesAbertas: boolean;
  capacidade: number;
  tolerancia: number;
  inscritos: number;
  reservas: number;
  livres: number;
  sessoes: number;
  realizadas: number;
  sumariosEmFalta: number;
  docsEmFalta: number;
  docsCompletos: number;
  ufcd: string;
  financiador: string;
  fechadaEm: string;
};

export type ResumoTurmas = { total: number; porFase: Partial<Record<FaseTurma, number>>; vagasLivres: number; inscricoesAbertas: number; inscritos: number };

export type FiltrosTurmas = {
  regime: Regime;
  fase?: string;
  curso?: string;
  local?: string;
  horario?: string;
  formador?: string;
  financiador?: string;
  de?: string;
  ate?: string;
  q?: string;
  pagina?: number;
  porPagina?: number;
  ordem?: string;
};

export function apiTurmas(f: FiltrosTurmas, signal?: AbortSignal) {
  return api<Pagina<LinhaTurma> & { resumo: ResumoTurmas }>(`/v1/turmas${qs(f)}`, { signal });
}

/** Turma completa (formato antigo, usado pelo cockpit e pelo formulário). */
export type TurmaGravada = {
  id: number;
  nome: string;
  curso: string;
  local: string;
  horario: string;
  dataInicio: string;
  formador: string;
  formadores: string[];
  estado: string;
  horas: number;
  cronograma: SessaoCronograma[];
  valoresHoraFormador: Record<string, number>;
  toleranciaVagas: number;
  vagasAnunciadas?: number | null;
  vagas?: number;
  custoHoraSala?: number;
  alunosTotal?: number;
  activa?: boolean;
  ufcdCod?: string;
  financiador?: string;
  /** Financiada: número da ação («… / Ação n» na execução física). */
  numeroAcao?: number;
};

export type DadosTurma = {
  nome: string;
  curso: string;
  local: string;
  horario: string;
  dataInicio: string;
  formador: string;
  formadores: string[];
  toleranciaVagas: number;
  vagasAnunciadas?: number | null;
  valoresHoraFormador: Record<string, number>;
  cronograma?: SessaoCronograma[];
  horas?: number;
  // Gold
  vagas?: number;
  custoHoraSala?: number;
  estado?: string;
  // Financiada
  alunosTotal?: number;
  activa?: boolean;
  financiador?: string;
  numeroAcao?: number;
};

const base = (regime: Regime) => `/v1/turmas-${regime}`;

export function apiCriarTurma(regime: Regime, dados: DadosTurma) {
  return enviar.post<{ turma: TurmaGravada }>(base(regime), dados);
}

export function apiAlterarTurma(regime: Regime, id: number, dados: Partial<DadosTurma>) {
  return enviar.patch<{ turma: TurmaGravada }>(`${base(regime)}/${id}`, dados);
}

export function apiApagarTurma(regime: Regime, id: number) {
  return enviar.delete<{ ok: true }>(`${base(regime)}/${id}`);
}

/** Abre ou fecha as inscrições (Gold: estado Ativa/Inativa; Financiada: activa). */
export function apiInscricoesTurma(regime: Regime, id: number, abertas: boolean) {
  return regime === "gold"
    ? apiAlterarTurma("gold", id, { estado: abertas ? "Ativa" : "Inativa" })
    : apiAlterarTurma("fin", id, { activa: abertas });
}

/** Turma completa, para o formulário de edição. */
export function apiTurmaGravada(regime: Regime, id: number, signal?: AbortSignal) {
  return api<{ turma: TurmaGravada }>(`/v1/turmas/${regime}/${id}`, { signal });
}
