// Moodle de cada curso (ficha do curso › Oferta): o endereço atual e, enquanto o Moodle é refeito, um endereço novo
// para as turmas que começam a partir de uma data e para as turmas escolhidas à mão. As outras continuam no atual.

export type MoodleDoCurso = {
  moodleUrl?: unknown;
  moodleNovoUrl?: unknown;
  /** Data (aaaa-mm-dd): as turmas que começam neste dia ou depois usam o endereço novo. */
  moodleNovoDesde?: unknown;
  /** Turmas existentes (ids) que passam já para o endereço novo. */
  moodleNovoTurmas?: unknown;
};

const url = (v: unknown) => (typeof v === "string" && /^https?:\/\/\S+$/i.test(v.trim()) ? v.trim() : "");
const dataIso = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : "");

export function idsTurmasMoodleNovo(v: unknown): number[] {
  return Array.isArray(v) ? [...new Set(v.map(Number).filter(n => Number.isInteger(n) && n > 0))] : [];
}

/** O endereço do Moodle de uma turma do curso (vazio se o curso não tiver nenhum). */
export function moodleDaTurma(curso: MoodleDoCurso, turma: { id: number; dataInicio?: string | null }) {
  const atual = url(curso.moodleUrl);
  const novo = url(curso.moodleNovoUrl);
  if (!novo) return atual;
  const desde = dataIso(curso.moodleNovoDesde);
  const inicio = dataIso(turma.dataInicio ?? "");
  const escolhida = idsTurmasMoodleNovo(curso.moodleNovoTurmas).includes(turma.id);
  return escolhida || (desde && inicio && inicio >= desde) ? novo : atual || novo;
}

/** O dia antes de «a partir de» (dd/mm/aaaa), para «cursos iniciados até …» na página de entrada. */
export function diaAntesDe(desde: unknown) {
  const d = dataIso(desde);
  if (!d) return "";
  const t = new Date(`${d}T12:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  const iso = t.toISOString().slice(0, 10);
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
