export type OfertaTurma = {
  turmaId: number;
  nome: string;
  curso: string;
  local: string;
  horario: string;
  dataInicio: string;
  vagasLivres: number;
  /** As vagas que o site mostra (anunciadas pelo comercial, nunca acima das livres). */
  vagasMostradas?: number;
  preco?: number | null;
  cronogramaPublicado?: boolean;
  regime?: "gold" | "fin";
};

/** Texto público das vagas de uma turma (sem o código interno da turma). */
export function vagasPublicas(t: Pick<OfertaTurma, "vagasLivres" | "vagasMostradas">) {
  const n = t.vagasMostradas ?? t.vagasLivres;
  if (!t.vagasLivres || !n) return "sem vagas";
  return n === 1 ? "1 vaga restante" : `${n} vagas restantes`;
}

export type CursoOfertaSel = {
  curso: string;
  local: string;
  horario: string;
  dataInicio: string;
  turmaId: number;
};

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
