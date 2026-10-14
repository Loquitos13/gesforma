// Continuação de turmaModel.ts (partido para ficar abaixo das 500 linhas).
import type { SelectOption } from "./FormKit";
import { lugaresLivres, TurmaGold, TurmaFin, isTurmaActiva, hojeIso, formatDiaMes, chaveOferta, chaveHorario, partirLocalHorario, locaisEquivalentes, OfertaTurmaRef } from "./turmaModel";

export function preinscricaoCasaComTurma(
  lead: { curso: string; local: string; horario?: string; turmaId?: number; estado: string; inicioCurso?: string },
  turma: OfertaTurmaRef,
) {
  if (lead.estado === "Formando" || lead.estado === "Desistiu") return false;
  if (lead.turmaId && lead.turmaId === turma.id) return true;
  if (chaveOferta(lead.curso) !== chaveOferta(turma.curso)) return false;
  const partido = partirLocalHorario(lead.local, lead.horario);
  if (!locaisEquivalentes(partido.local, turma.local)) return false;
  const hLead = chaveHorario(partido.horario);
  const hTurma = chaveHorario(turma.horario);
  if (hLead) return hLead === hTurma;
  const inicio = (lead.inicioCurso ?? "").slice(0, 10);
  const dataTurma = (turma.dataInicio ?? "").slice(0, 10);
  return Boolean(inicio && dataTurma && inicio === dataTurma);
}

export type LeadOfertaRef = {
  curso: string;
  local: string;
  horario?: string;
  turmaId?: number;
  inicioCurso?: string;
};

export type TurmaInscricaoLinha = {
  turma: TurmaGold;
  grupo: "adequada" | "outro";
  disabled: boolean;
  motivo: string;
};

/** Horário da pré-inscrição, ou o da turma com a mesma data de início no mesmo local. */
export function horarioPreferidoDoLead(lead: LeadOfertaRef, turmas: TurmaGold[] = []) {
  const partido = partirLocalHorario(lead.local, lead.horario);
  if (chaveHorario(partido.horario)) return partido.horario;
  if (lead.turmaId) {
    const pin = turmas.find(t => t.id === lead.turmaId);
    if (pin?.horario) return pin.horario;
  }
  const inicio = (lead.inicioCurso ?? "").slice(0, 10);
  if (!inicio) return "";
  const hit = turmas.find(t =>
    chaveOferta(t.curso) === chaveOferta(lead.curso)
    && locaisEquivalentes(t.local, partido.local)
    && t.dataInicio.slice(0, 10) === inicio
    && chaveHorario(t.horario));
  return hit?.horario ?? "";
}

export function turmaAdequadaAoLead(lead: LeadOfertaRef, turma: TurmaGold, turmas: TurmaGold[] = []) {
  if (lead.turmaId && lead.turmaId === turma.id) return true;
  if (chaveOferta(lead.curso) !== chaveOferta(turma.curso)) return false;
  const partido = partirLocalHorario(lead.local, lead.horario);
  if (!locaisEquivalentes(partido.local, turma.local)) return false;
  const hLead = chaveHorario(horarioPreferidoDoLead(lead, turmas.length ? turmas : [turma]));
  if (hLead) return hLead === chaveHorario(turma.horario);
  const inicio = (lead.inicioCurso ?? "").slice(0, 10);
  return Boolean(inicio && inicio === turma.dataInicio.slice(0, 10));
}

export function linhasTurmaInscricao(turmas: TurmaGold[], lead: LeadOfertaRef, hoje = hojeIso()): TurmaInscricaoLinha[] {
  const partido = partirLocalHorario(lead.local, lead.horario);
  const mesmoCursoLocal = turmas.filter(t =>
    chaveOferta(t.curso) === chaveOferta(lead.curso) && locaisEquivalentes(t.local, partido.local));
  const adequadas = mesmoCursoLocal.filter(t => turmaAdequadaAoLead(lead, t, turmas));
  const ids = new Set(adequadas.map(t => t.id));
  const outros = mesmoCursoLocal.filter(t =>
    !ids.has(t.id) && t.dataInicio.slice(0, 10) >= hoje);

  const linhaAdequada = (t: TurmaGold): TurmaInscricaoLinha => {
    const vagas = Math.max(0, lugaresLivres(t));
    if (!isTurmaActiva(t)) return { turma: t, grupo: "adequada", disabled: true, motivo: "Não libertada" };
    if (vagas <= 0) return { turma: t, grupo: "adequada", disabled: true, motivo: "Sem vagas" };
    return { turma: t, grupo: "adequada", disabled: false, motivo: `${vagas} vaga${vagas === 1 ? "" : "s"}` };
  };
  const linhaOutro = (t: TurmaGold): TurmaInscricaoLinha => ({
    turma: t,
    grupo: "outro",
    disabled: true,
    motivo: `Outro horário · começa ${formatDiaMes(t.dataInicio)}`,
  });

  const sortData = (a: TurmaGold, b: TurmaGold) => a.dataInicio.localeCompare(b.dataInicio) || a.nome.localeCompare(b.nome, "pt");
  return [
    ...adequadas.slice().sort((a, b) => {
      const pin = (t: TurmaGold) => (lead.turmaId && t.id === lead.turmaId ? 0 : 1);
      return pin(a) - pin(b) || sortData(a, b);
    }).map(linhaAdequada),
    ...outros.slice().sort(sortData).map(linhaOutro),
  ];
}

export function turmaGoldOpts(
  turmas: TurmaGold[],
  opts?: { curso?: string; includeNome?: string },
): SelectOption[] {
  return turmas
    .filter(t => {
      if (opts?.curso && t.curso !== opts.curso) return false;
      if (isTurmaActiva(t)) return true;
      return Boolean(opts?.includeNome && t.nome === opts.includeNome);
    })
    .map(t => ({
      value: t.nome,
      sub: isTurmaActiva(t)
        ? `${t.local} · ${t.horario} · ${Math.max(0, lugaresLivres(t))} vagas restantes`
        : `${t.local} · Inativa - não aceita novas inscrições`,
    }));
}

export function turmaFinOpts(
  turmas: TurmaFin[],
  opts?: { curso?: string; includeNome?: string },
): SelectOption[] {
  return turmas
    .filter(t => {
      if (opts?.curso && t.curso !== opts.curso && !t.nome.includes(opts.curso)) return false;
      if (isTurmaActiva(t)) return true;
      return Boolean(opts?.includeNome && t.nome === opts.includeNome);
    })
    .map(t => ({
      value: t.nome,
      sub: isTurmaActiva(t)
        ? `UFCD ${t.ufcdCod} · ${Math.max(0, lugaresLivres(t))} vagas restantes`
        : `UFCD ${t.ufcdCod} · Inativa - não aceita novas inscrições`,
    }));
}

