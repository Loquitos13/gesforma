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
  /** Data limite da matrícula (marcador do cronograma), ou "". */
  matricula?: string;
};

const semVagas = (t: Pick<OfertaTurma, "vagasLivres" | "vagasMostradas">) => !t.vagasLivres || !(t.vagasMostradas ?? t.vagasLivres);

/**
 * Turmas que o site mostra. Uma turma cheia esconde-se quando há outra turma aberta do mesmo curso, local e horário
 * com vagas; se não houver, fica à vista mas bloqueada («Novas datas em breve», ver `turmaCheia`).
 */
export function turmasParaMostrar<T extends OfertaTurma>(turmas: T[]): T[] {
  const chave = (t: OfertaTurma) => `${t.regime ?? ""}|${t.curso}|${t.local}|${t.horario}`.toLowerCase();
  const comVagas = new Set(turmas.filter(t => !semVagas(t)).map(chave));
  return turmas.filter(t => !semVagas(t) || !comVagas.has(chave(t)));
}

/** A turma está cheia (o site mostra-a bloqueada, com «Novas datas em breve»). */
export function turmaCheia(t: Pick<OfertaTurma, "vagasLivres" | "vagasMostradas">) {
  return semVagas(t);
}

/** Texto público das vagas de uma turma (sem o código interno da turma). */
export function vagasPublicas(t: Pick<OfertaTurma, "vagasLivres" | "vagasMostradas">) {
  const n = t.vagasMostradas ?? t.vagasLivres;
  if (!t.vagasLivres || !n) return "Novas datas em breve";
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
