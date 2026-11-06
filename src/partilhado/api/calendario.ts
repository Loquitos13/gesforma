import { api, qs } from "./cliente";
import type { EventoCal } from "../CalendarioEventos";

export type EventoCalendario = EventoCal & {
  regime: "gold" | "fin"; turma: string; turmaId: number | null; curso: string; modulos: string[]; formadores: string[]; local: string; modalidade: string; leadId?: number;
};

/** Eventos do calendário de quem pede (a equipa vê o seu regime; o formador as suas sessões). */
export const apiCalendario = (de: string, ate: string, signal?: AbortSignal) =>
  api<{ eventos: EventoCalendario[] }>(`/v1/calendario${qs({ de, ate })}`, { signal });
