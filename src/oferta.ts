export type OfertaTurma = {
  turmaId: number;
  nome: string;
  curso: string;
  local: string;
  horario: string;
  dataInicio: string;
  vagasLivres: number;
  preco?: number | null;
};

export type CursoOfertaSel = {
  curso: string;
  local: string;
  horario: string;
  dataInicio: string;
  turmaId: number;
};

export function fmtDataPt(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso || "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function uniqueVals(turmas: OfertaTurma[], key: keyof OfertaTurma) {
  return [...new Set(turmas.map(t => String(t[key] ?? "")).filter(Boolean))];
}

export function ofertaFiltrada(
  turmas: OfertaTurma[],
  sel: { curso?: string; local?: string; horario?: string },
) {
  return turmas.filter(t =>
    (!sel.curso || t.curso === sel.curso)
    && (!sel.local || t.local === sel.local)
    && (!sel.horario || t.horario === sel.horario),
  );
}

export const OFERTA_VAZIA: CursoOfertaSel = {
  curso: "", local: "", horario: "", dataInicio: "", turmaId: 0,
};

export function labelOferta(sel: Pick<CursoOfertaSel, "curso" | "local" | "horario" | "dataInicio">) {
  if (!sel.curso) return "";
  return [sel.curso, sel.local, sel.horario, sel.dataInicio ? fmtDataPt(sel.dataInicio) : ""]
    .filter(Boolean)
    .join(" · ");
}
