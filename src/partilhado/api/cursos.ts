// API do domínio "cursos": catálogo Gold e financiado, ficha (site e pedagogia) e imagens.
import { api, enviar, enviarFicheiro, qs } from "./cliente";

export type Regime = "gold" | "fin";

/** Uso de cada curso, contado no servidor. */
export type UsoCurso = { turmasAbertas: number; turmasTotal: number; formandos: number; preinscricoes: number; temFicha: boolean };

export type CursoGold = {
  id: number; nome: string; categoria: string; tipo: string; preco: number; regime: string; horas: number; estado: string;
  entidadeResponsavelId: number | null; uso: UsoCurso;
};

export type CursoFin = {
  id: number; ufcdCod: string; ufcd: string; nomeComercial: string; regime: string; horas: number; estado: string; uso: UsoCurso;
};

export type ResumoCursos = { total: number; ativos: number; comTurmas: number };

export type FiltroCursos = { q?: string; estado?: string; categoria?: string; tipo?: string; modalidade?: string; ordem?: string };

export type TurmaDoCurso = {
  id: number; nome: string; inicio: string; local: string; horario: string; formador: string; inscritos: number; vagas: number; fechada: boolean;
};

export function apiCursosGold(f: FiltroCursos, signal?: AbortSignal) {
  return api<{ cursos: CursoGold[]; resumo: ResumoCursos }>(`/v1/cursos/gold${qs(f)}`, { signal, silencioso: true });
}

export function apiCursosFin(f: FiltroCursos, signal?: AbortSignal) {
  return api<{ cursos: CursoFin[]; resumo: ResumoCursos }>(`/v1/cursos/fin${qs(f)}`, { signal, silencioso: true });
}

export function apiCursoGold(id: number, signal?: AbortSignal) {
  return api<{ curso: CursoGold; turmas: TurmaDoCurso[] }>(`/v1/cursos/gold/${id}`, { signal, silencioso: true });
}

export function apiCursoFin(id: number, signal?: AbortSignal) {
  return api<{ curso: CursoFin; turmas: TurmaDoCurso[] }>(`/v1/cursos/fin/${id}`, { signal, silencioso: true });
}

export type DadosCursoGold = Omit<CursoGold, "id" | "uso" | "entidadeResponsavelId"> & { entidadeResponsavelId?: number | null };
export type DadosCursoFin = Omit<CursoFin, "id" | "uso">;

export const apiCriarCursoGold = (d: DadosCursoGold) => enviar.post<{ curso: CursoGold }>("/v1/cursos-gold", d);
export const apiEditarCursoGold = (id: number, d: Partial<DadosCursoGold>) => enviar.patch<{ curso: CursoGold }>(`/v1/cursos-gold/${id}`, d);
export const apiCriarCursoFin = (d: DadosCursoFin) => enviar.post<{ curso: CursoFin }>("/v1/cursos-fin", d);
export const apiEditarCursoFin = (id: number, d: Partial<DadosCursoFin>) => enviar.patch<{ curso: CursoFin }>(`/v1/cursos-fin/${id}`, d);
export const apiApagarCurso = (regime: Regime, id: number) => enviar.delete<{ ok: boolean }>(`/v1/cursos-${regime}/${id}`);

export type FichaCurso = { payload: Record<string, unknown>; criterios: { id: string; label: string }[] };

export function apiFichaCurso(regime: Regime, id: number, signal?: AbortSignal) {
  return api<{ ficha: FichaCurso | null }>(`/v1/cursos/${regime}/${id}/ficha`, { signal, silencioso: true });
}

export const apiGravarFichaCurso = (regime: Regime, id: number, corpo: { payload?: Record<string, unknown>; criterios?: { id: string; label: string }[] }) =>
  enviar.put<{ ok: boolean }>(`/v1/cursos/${regime}/${id}/ficha`, corpo);

export const apiImagemCurso = (regime: Regime, id: number, slot: "banner" | "capa" | "miniatura", ficheiro: File) =>
  enviarFicheiro<{ nome: string; url: string }>(`/v1/cursos/${regime}/${id}/imagem/${slot}`, ficheiro);
