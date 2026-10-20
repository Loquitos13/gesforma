// API do domínio "formadores": lista com KPIs, ficha, documentos e escrita.
import { api, enviar, qs, type Pagina } from "./cliente";

export type Regime = "gold" | "fin";
export type EstadoFormador = "Ativo" | "Inactivo";

export type FormadorBase = {
  id: number;
  nome: string;
  telf: string;
  email: string;
  especialidade: string;
  ccp: string;
  ccpValidade: string;
  nif: string;
  regimes: Regime[];
  estado: EstadoFormador;
  disponibilidade: string[];
  custoHora: number;
  temAcesso: boolean;
};

export type LinhaFormador = FormadorBase & {
  turmas: number;
  turmasAtivas: number;
  horasDadas: number;
  horasPendentes: number;
  proximaSessao: string;
  docsEmFalta: number;
  ccpAExpirar: boolean;
  ccpExpirado: boolean;
};

export type KpisFormadores = { ativos: number; total: number; comTurma: number; docsEmFalta: number; ccpAExpirar: number; horasDadas: number };

export type AlertaFormador = "docs" | "ccp" | "com_turma" | "sem_turma";

export type FiltrosFormadores = {
  regime: Regime;
  estado?: string;
  especialidade?: string;
  disponibilidade?: string;
  alerta?: string;
  q?: string;
  pagina?: number;
  porPagina?: number;
  ordem?: string;
};

export function apiFormadores(f: FiltrosFormadores, signal?: AbortSignal) {
  return api<Pagina<LinhaFormador> & { kpis: KpisFormadores; especialidades: string[] }>(`/v1/formadores${qs(f)}`, { signal, silencioso: true });
}

export type TurmaDoFormador = {
  regime: Regime;
  id: number;
  nome: string;
  curso: string;
  responsavel: boolean;
  fechada: boolean;
  inicio: string;
  fim: string;
  sessoes: number;
  horasDadas: number;
  horasPendentes: number;
  valorHora: number;
  valorDado: number;
};

export type SessaoDoFormador = {
  regime: Regime;
  turmaId: number;
  turma: string;
  curso: string;
  data: string;
  horaInicio: string;
  horaFim: string;
  horas: number;
};

export type DocFormador = { id: string; uploaded: boolean; fileName: string; driveFileId: string; driveUrl: string; atualizadoEm?: string };

export type FichaFormador = {
  formador: FormadorBase & { ccpExpirado: boolean; ccpAExpirar: boolean };
  turmas: TurmaDoFormador[];
  sessoes: SessaoDoFormador[];
  docs: DocFormador[];
  acesso: { email: string; ativo: boolean; porTrocarPalavraPasse: boolean; ultimoAcesso: string } | null;
  totais: { turmas: number; turmasAtivas: number; horasDadas: number; horasPendentes: number; valorDado: number; docsEmFalta: number };
  hoje: string;
};

export function apiFichaFormador(id: number, signal?: AbortSignal) {
  return api<FichaFormador>(`/v1/formadores/${id}`, { signal, silencioso: true });
}

export type OcupacaoFormador = {
  formador: { id: number; nome: string };
  sessoes: { regime: Regime; turmaId: number; turma: string; data: string; horaInicio: string; horaFim: string }[];
};

/** Horários ocupados do formador entre duas datas (todas as turmas). */
export function apiOcupacaoFormador(id: number, de: string, ate: string, signal?: AbortSignal) {
  return api<OcupacaoFormador>(`/v1/formadores/${id}/ocupacao?de=${de}&ate=${ate}`, { signal, silencioso: true });
}

/** Id da ficha de formador ligada à conta autenticada. */
export function apiMeuFormador(signal?: AbortSignal) {
  return api<{ id: number }>("/v1/formadores/eu", { signal, silencioso: true });
}

export type DadosFormador = {
  nome: string;
  telf: string;
  email: string;
  especialidade: string;
  ccp: string;
  ccpValidade: string;
  nif: string;
  regimes: Regime[];
  estado: EstadoFormador;
  disponibilidade: string[];
  custoHora: number;
};

export type AcessoCriado = { email: string; password?: string; criado: boolean } | null;

export function apiCriarFormador(dados: DadosFormador) {
  return enviar.post<{ formador: FormadorBase; acesso: AcessoCriado }>("/v1/formadores", dados);
}

export function apiAlterarFormador(id: number, dados: Partial<DadosFormador>) {
  return enviar.patch<{ formador: FormadorBase; acesso: AcessoCriado }>(`/v1/formadores/${id}`, dados);
}

/** Junta um regime à ficha que já existe com este email (a mesma pessoa noutro regime). */
export function apiJuntarRegimeFormador(id: number, regime: Regime, email: string) {
  return enviar.post<{ formador: FormadorBase; acesso: AcessoCriado }>(`/v1/formadores/${id}/regimes`, { regime, email });
}

export function apiApagarFormador(id: number) {
  return enviar.delete<{ ok: true }>(`/v1/formadores/${id}`);
}

export function apiGravarDocsFormador(id: number, docs: Omit<DocFormador, "atualizadoEm">[]) {
  return enviar.put<{ ok: true }>(`/v1/formadores/${id}/docs`, { docs });
}
