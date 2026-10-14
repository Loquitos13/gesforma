// API do domínio "dtp": vista geral do dossiê técnico-pedagógico por regime e exportação ZIP.
import { apiDtpExport } from "../api";
import { api } from "./cliente";

export type Regime = "gold" | "fin";
export type EstadoSeccao = "completo" | "parcial" | "falta" | "bloqueante" | "na";

export type SeccaoDtp = { id: string; label: string; pasta: string };

export type ItemEmFalta = { id: string; label: string; estado: "parcial" | "falta"; bloqueante: boolean; seccao: string; detalhe: string };

export type TurmaDtp = {
  id: number;
  nome: string;
  curso: string;
  estado: string;
  inicio: string;
  financiador: string;
  fechada: boolean;
  pct: number;
  ok: number;
  parcial: number;
  falta: number;
  total: number;
  bloqueantes: number;
  celulas: { seccao: string; estado: EstadoSeccao; ok: number; total: number }[];
  emFalta: ItemEmFalta[];
};

export type MatrizDtp = { seccoes: SeccaoDtp[]; turmas: TurmaDtp[] };

export function apiMatrizDtp(regime: Regime, signal?: AbortSignal) {
  return api<MatrizDtp>(`/v1/dtp/${regime}/resumo`, { signal, silencioso: true });
}

/** ZIP do dossiê da turma, organizado pelas pastas (Gold) ou tópicos (Financiada). */
export function apiExportarDtp(regime: Regime, turmaId: number, nome: string) {
  return apiDtpExport(regime, turmaId, `${nome || "dossie"}.zip`);
}
