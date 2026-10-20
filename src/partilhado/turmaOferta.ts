// Continuação de turmaModel.ts (partido para ficar abaixo das 500 linhas).
import { chaveOferta, chaveHorario, partirLocalHorario, locaisEquivalentes, type OfertaTurmaRef } from "./turmaModel";

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
